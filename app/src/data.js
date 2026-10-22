import { sb, ok, colorFor, upload } from './lib';

const q = async (p) => { const { data, error } = await p; if (error) throw error; return data || []; };

export const EMPTY = {
  me: null, users: {}, posts: [], repostsBy: {}, stories: [], seen: {}, threads: {}, unread: {}, seenBy: {}, notifs: [], blocked: {},
  priv: { points: 0, owned: { stickers: { basic: 1 } }, theme: 'ember', custom: [], settings: {} }, week: {}, shop: [], deals: [], loaded: false,
};

export async function loadAll(myId) {
  const [profiles, follows, blocks, posts, reacts, saves, stories, sviews, msgs, notifs, privRows, week, shop, deals, reposts, storyBurns] = await Promise.all([
    q(sb.from('profiles').select('*').limit(5000)),
    q(sb.from('follows').select('follower,followee').limit(20000)),
    q(sb.from('blocks').select('blocked')),
    q(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(300)),
    q(sb.from('reactions').select('post_id,kind').eq('user_id', myId).limit(5000)),
    q(sb.from('saves').select('post_id')),
    q(sb.from('stories').select('*').order('created_at')),
    q(sb.from('story_views').select('story_id')),
    q(sb.from('messages').select('*').order('created_at').limit(3000)),
    q(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(150)),
    q(sb.from('profile_private').select('*').eq('id', myId)),
    q(sb.rpc('week_stats')),
    q(sb.from('shop_items').select('*')),
    q(sb.rpc('deals_today')).catch(() => []),
    q(sb.from('reposts').select('user_id,post_id,created_at').order('created_at', { ascending: false }).limit(20000)),
    q(sb.rpc('story_burns_left')).catch(() => 3),
  ]);
  const ids = posts.map((p) => p.id);
  const comments = ids.length ? await q(sb.from('comments').select('*').in('post_id', ids).order('created_at').limit(5000)) : [];
  const cids = comments.map((c) => c.id);
  const myLikes = cids.length ? await q(sb.from('comment_likes').select('comment_id').eq('user_id', myId).in('comment_id', cids)) : [];

  const users = {};
  profiles.forEach((p) => {
    users[p.id] = { id: p.id, name: p.name, handle: p.handle, bio: p.bio || '', avatar: p.avatar_url, header: p.header_url, headerFx: p.header_fx,
      ring: p.ring, stickers: p.stickers || [], isPrivate: p.is_private, color: colorFor(p.id), followers: 0, followingCount: 0, following: false, followsMe: false };
  });
  follows.forEach((f) => {
    const a = users[f.followee], b = users[f.follower];
    if (a) a.followers++;
    if (b) b.followingCount++;
    if (f.follower === myId && a) a.following = true;
    if (f.followee === myId && b) b.followsMe = true;
  });
  const blocked = {}; blocks.forEach((b) => (blocked[b.blocked] = true));
  const mh = new Set(reacts.filter((r) => r.kind === 'heat').map((r) => r.post_id));
  const mf = new Set(reacts.filter((r) => r.kind === 'freeze').map((r) => r.post_id));
  const sv = new Set(saves.map((x) => x.post_id)), liked = new Set(myLikes.map((x) => x.comment_id));
  const myReposts = new Set(reposts.filter((r) => r.user_id === myId).map((r) => r.post_id));
  const repostsBy = {}; reposts.forEach((r) => { (repostsBy[r.user_id] = repostsBy[r.user_id] || []).push(r.post_id); });
  const cm = {};
  comments.forEach((c) => {
    if (!users[c.user_id]) return;
    (cm[c.post_id] = cm[c.post_id] || []).push({ id: c.id, userId: c.user_id, text: c.text || '', sticker: c.sticker, at: +new Date(c.created_at), likes: c.likes, myLike: liked.has(c.id) });
  });
  const P = posts.filter((p) => users[p.user_id]).map((p) => ({
    id: p.id, userId: p.user_id, text: p.text || '', mediaUrl: p.media_url, mediaType: p.media_type, gif: p.is_gif, reel: p.reel, seed: p.clip_seed || 1,
    createdAt: +new Date(p.created_at), status: p.status, burnEnds: p.burn_ends ? +new Date(p.burn_ends) : null, heat: p.heat, freeze: p.freezes, views: p.views,
    myHeat: mh.has(p.id), myFreeze: mf.has(p.id), saved: sv.has(p.id), comments: cm[p.id] || [], reposts: p.reposts || 0, myRepost: myReposts.has(p.id), overlay: p.overlay || null,
  }));
  const st = {};
  const sids = stories.map((x) => x.id);
  const [scom, sreact] = sids.length ? await Promise.all([
    q(sb.from('story_comments').select('*').in('story_id', sids).order('created_at').limit(3000)),
    q(sb.from('story_reactions').select('story_id,user_id,emoji').in('story_id', sids).limit(10000))]) : [[], []];
  const sc = {}, sr = {}, smy = {};
  scom.forEach((c) => { if (!users[c.user_id]) return; (sc[c.story_id] = sc[c.story_id] || []).push({ id: c.id, userId: c.user_id, text: c.text, at: +new Date(c.created_at) }); });
  sreact.forEach((r) => { const m = (sr[r.story_id] = sr[r.story_id] || {}); m[r.emoji] = (m[r.emoji] || 0) + 1; if (r.user_id === myId) smy[r.story_id] = r.emoji; });
  stories.forEach((x) => { if (!users[x.user_id]) return; (st[x.user_id] = st[x.user_id] || { userId: x.user_id, items: [] }).items.push({ id: x.id, type: x.media_type, url: x.media_url, caption: x.caption || '', at: +new Date(x.created_at),
    comments: sc[x.id] || [], reacts: sr[x.id] || {}, myReact: smy[x.id] || null }); });
  const seen = {}; sviews.forEach((v) => (seen[v.story_id] = true));
  const threads = {}, unread = {}, seenBy = {};
  msgs.forEach((m) => {
    const other = m.sender === myId ? m.recipient : m.sender;
    if (!users[other]) return;
    (threads[other] = threads[other] || []).push({ id: m.id, from: m.sender, text: m.text || '', sticker: m.sticker, postId: m.post_id, snap: m.snap, note: m.note, react: m.react, audio: m.audio_url, ms: m.audio_ms, at: +new Date(m.created_at), readAt: m.read_at ? +new Date(m.read_at) : 0 });
    if (m.recipient === myId && !m.read_at) unread[other] = true;
    if (m.sender === myId && m.read_at) seenBy[other] = Math.max(seenBy[other] || 0, +new Date(m.read_at));
  });
  const N = notifs.filter((n) => users[n.actor_id || n.user_id]).map((n) => ({ id: n.id, type: n.type, userId: n.actor_id || n.user_id, text: n.text || '', at: +new Date(n.created_at), read: n.read, postId: n.post_id }));
  const weekMap = {}; week.forEach((w) => (weekMap[w.user_id] = w));
  const priv = privRows[0] || EMPTY.priv;
  return { me: myId, storyBurns: typeof storyBurns === 'number' ? storyBurns : 3, users, posts: P, repostsBy, stories: Object.values(st), seen, threads, unread, seenBy, notifs: N, blocked,
    priv: { ...EMPTY.priv, ...priv, settings: priv.settings || {}, custom: priv.custom || [], owned: priv.owned || EMPTY.priv.owned }, week: weekMap, shop, deals, loaded: true };
}

/* ---------- writes (the database enforces every rule) ---------- */
export const act = {
  react: (postId, kind) => ok(sb.from('reactions').insert({ post_id: postId, kind })),
  view: (postId) => sb.rpc('add_view', { pid: postId }),
  repost: (postId, reposted, me) => (reposted ? ok(sb.from('reposts').delete().eq('user_id', me).eq('post_id', postId)) : ok(sb.from('reposts').insert({ post_id: postId }))),
  save: (postId, saved, me) => (saved ? ok(sb.from('saves').delete().eq('user_id', me).eq('post_id', postId)) : ok(sb.from('saves').insert({ post_id: postId }))),
  async post(me, { text, asset, reel, overlay }) {
    const row = { text: text || '', reel: !!reel };
    if (overlay) row.overlay = overlay;
    if (asset && asset.remote) { row.media_url = asset.uri; row.media_type = 'image'; row.is_gif = true; }
    else if (asset) { row.media_url = await upload(me, asset); row.media_type = asset.type === 'video' ? 'video' : 'image'; row.is_gif = /gif/i.test(asset.mimeType || asset.uri || ''); }
    else if (reel) row.clip_seed = Math.floor(Math.random() * 9999) + 1;
    return ok(sb.from('posts').insert(row));
  },
  comment: (postId, text, sticker) => ok(sb.from('comments').insert({ post_id: postId, text: text || '', sticker: sticker || null })),
  likeComment: (cid, liked, me) => (liked ? ok(sb.from('comment_likes').delete().eq('comment_id', cid).eq('user_id', me)) : ok(sb.from('comment_likes').insert({ comment_id: cid }))),
  follow: (uid, following, me) => (following ? ok(sb.from('follows').delete().eq('follower', me).eq('followee', uid)) : ok(sb.from('follows').insert({ followee: uid }))),
  burnStory: async (id) => { const { data, error } = await sb.rpc('burn_story', { sid: id }); if (error) throw new Error(error.message); return data; },
  async story(me, asset, caption) { const url = await upload(me, asset); return ok(sb.from('stories').insert({ media_url: url, media_type: asset.type === 'video' ? 'video' : 'image', caption: caption || '' })); },
  storyComment: (id, text) => ok(sb.from('story_comments').insert({ story_id: id, text })),
  storyReact: (id, emoji, current, me) => (current === emoji
    ? ok(sb.from('story_reactions').delete().eq('story_id', id).eq('user_id', me))
    : ok(sb.from('story_reactions').upsert({ story_id: id, user_id: me, emoji }, { onConflict: 'story_id,user_id' }))),
  seenStory: (id) => sb.from('story_views').upsert({ story_id: id }, { onConflict: 'story_id,user_id', ignoreDuplicates: true }),
  dm: (to, { text, sticker, post, note, audio, ms }) => {
    const snap = post ? { userId: post.userId, text: post.text, media: post.mediaUrl ? { type: post.mediaType || (post.reel ? 'video' : 'image'), url: post.mediaUrl } : null } : null;
    return ok(sb.from('messages').insert({ recipient: to, text: text || '', sticker: sticker || null, post_id: post ? post.id : null, snap, note: note || null, audio_url: audio || null, audio_ms: ms || null }));
  },
  reactMsg: (m) => ok(sb.from('messages').update({ react: m.react ? null : '❤️' }).eq('id', m.id)),
  read: (other, me) => sb.from('messages').update({ read_at: new Date().toISOString() }).eq('sender', other).eq('recipient', me).is('read_at', null),
  readNotifs: (me, types) => { let x = sb.from('notifications').update({ read: true }).eq('user_id', me).eq('read', false); if (types) x = x.in('type', types); return x; },
  block: (uid) => ok(sb.from('blocks').insert({ blocked: uid })),
  unblock: (uid, me) => ok(sb.from('blocks').delete().eq('blocker', me).eq('blocked', uid)),
  async profile(me, { name, bio, handle, avatar, header, isPrivate }) {
    const up = {};
    if (name !== undefined) up.name = name;
    if (bio !== undefined) up.bio = bio;
    if (handle !== undefined) up.handle = handle.toLowerCase();
    if (isPrivate !== undefined) up.is_private = isPrivate;
    if (avatar && avatar.uri) up.avatar_url = await upload(me, avatar);
    if (header && header.uri) { up.header_url = await upload(me, header); up.header_fx = null; }
    return ok(sb.from('profiles').update(up).eq('id', me));
  },
  settings: (me, settings) => ok(sb.from('profile_private').update({ settings }).eq('id', me)),
  ash: async (id) => { const { error } = await sb.rpc('ash_post', { pid: id }); if (error) throw new Error(error.message); },
  buy: async (kind, id) => { const { error } = await sb.rpc('buy', { k: kind, item: id }); if (error) throw new Error(error.message); },
  equip: (me, kind, id) => (kind === 'themes' ? ok(sb.from('profile_private').update({ theme: id || 'ember' }).eq('id', me))
    : ok(sb.from('profiles').update(kind === 'rings' ? { ring: id } : { header_fx: id }).eq('id', me))),
  profileStickers: (me, list) => ok(sb.from('profiles').update({ stickers: list }).eq('id', me)),
};
