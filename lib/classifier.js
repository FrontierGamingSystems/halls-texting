import crypto from "node:crypto";
const extraAliases = {
  'round2-967c3ce42c09': ['Chumash Casino','Chumash Mobile'],
  'round2-543b55b3a4a3': ['Agua Caliente'],
  'house-bingo-lax': ['House 8ingo','House Bingo','HouseBingoLAX'],
  'bd-bingo-industry': ['Industry BNGO','Industry Bingo'],
  'bd-bingo-suisun-city': ['Suisun Bingo','BD Suisun'],
  'scout-napa-bingo-emporium': ['Napa Bingo'],
  'hall-20f21eae092e': ['Fantasy Springs Resort'],
  'hall-16413e848b2f': ['Table Mountain'],
  'daub-4-kids': ['Daub 4 Kids', 'Daub4Kids'],
  'park-place': ['Park Place Bingo', 'PPBingo'],
  'milpitas-charity': ['Milpitas Charity Bingo', 'MCB'],
  'broadway-salinas': ['Broadway Bingo'],
  'aquamaids': ['Aquamaids', 'Aqua Maids Bingo'],
  'area-24th-street-bingo': ['24th Street Bingo', '24th St Bingo', '24th Street B','24th Street'],
  'scout-modesto-bingo-at-princeton-event-center': ['Modesto Bingo', 'Princeton Event Center'],
  'scout-salinas-park-n-play-bingo': ['Salinas Park n Play', 'Salinas Park and Play'],
  'area-bd-bingo-sacramento-at-mandarins-event-center': ['BD Bingo Sacramento', 'Blue Devils Sacramento', 'BD Sacramento'],
  'scout-bd-bingo-concord-blue-devils-aquanuts': ['BD Bingo Concord', 'Blue Devils Concord', 'BD Concord', 'Aquanuts Bingo', 'Concord Bingo'],
  'scout-bd-bingo-pleasanton-alameda-county-fairgrounds': ['BD Bingo Pleasanton', 'Blue Devils Pleasanton', 'BD Pleasanton', 'Pleasanton Bingo'],
  'scout-vanguard-bingo-santa-clara': ['Vanguard Bingo Santa Clara', 'Santa Clara Vanguard Bingo'],
  'scout-vanguard-bingo-redwood-city': ['Vanguard Bingo Redwood City', 'Redwood City Vanguard Bingo']
};
const operatorRules = [
  {name: 'Vanguard', aliases: ['Vanguard'], locations: [
    {id:'scout-vanguard-bingo-santa-clara', aliases:['Santa Clara']},
    {id:'scout-vanguard-bingo-redwood-city', aliases:['Redwood City']}
  ]},
  {name: 'Blue Devils', aliases: ['Blue Devils', 'BD Bingo'], locations: [
    {id:'area-bd-bingo-sacramento-at-mandarins-event-center', aliases:['Sacramento','Rancho Cordova']},
    {id:'scout-bd-bingo-concord-blue-devils-aquanuts', aliases:['Concord']},
    {id:'scout-bd-bingo-pleasanton-alameda-county-fairgrounds', aliases:['Pleasanton']}
  ]}
];
function normalize(s) {
  return String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function contains(text, alias) { return (' ' + text + ' ').includes(' ' + normalize(alias) + ' '); }
function senderKey(raw) {
  const s = String(raw).replace(/[^0-9]/g, '');
  if (/^\d{5,6}$/.test(s)) return s;
  if (/^\d{10}$/.test(s)) return '+1' + s;
  if (/^1\d{10}$/.test(s)) return '+' + s;
  return String(raw);
}
export function classify(message, directory) {
  if (!message || typeof message.body !== 'string' || !message.body.trim()) throw new Error('A nonempty body is required');
  if (typeof message.from !== 'string' || !message.from.trim()) throw new Error('from must be a sender string');
  const receivedAt = message.receivedAt;
  if (typeof receivedAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(receivedAt) || Number.isNaN(Date.parse(receivedAt))) throw new Error('receivedAt must be an ISO timestamp with a timezone');
  const halls = directory.halls;
  const byId = new Map(halls.map(h => [h.id,h]));
  const sender = senderKey(message.from);
  const text = normalize(message.body);
  const evidence = [];
  const add = (hallId, type, value) => { if (byId.has(hallId)) evidence.push({hallId,type,value}); };
  for (const h of halls) {
    const aliases = [...new Set([h.name, ...(extraAliases[h.id] || [])])];
    for (const alias of aliases) if (contains(text, alias)) add(h.id, 'hall_name', alias);
  }
  const detectedOperators = [];
  const unresolvedOperatorIds = new Set();
  for (const rule of operatorRules) {
    if (!rule.aliases.some(a => contains(text,a))) continue;
    detectedOperators.push(rule.name);
    const places = rule.locations.filter(l => l.aliases.some(a => contains(text,a)));
    if (places.length) {
      for (const place of places) add(place.id, 'operator_and_location', rule.name + ' / ' + place.aliases.filter(a => contains(text,a)).join(', '));
    } else {
      for (const l of rule.locations) if (byId.has(l.id)) unresolvedOperatorIds.add(l.id);
    }
  }
  const links = [];
  for (const match of message.body.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    try { links.push(new URL(match[0].replace(/[.,;!?)}\]]+$/, ''))); } catch {}
  }
  const host = u => u.hostname.toLowerCase().replace(/^www\./,'');
  const urlPath = u => { try { return decodeURI(u.pathname).replace(/\/+$/,'') || '/'; } catch { return u.pathname; } };
  for (const link of links) {
    const sameHost = halls.filter(h => { try { return host(new URL(h.website)) === host(link); } catch { return false; }});
    for (const h of sameHost) {
      const homepage = new URL(h.website);
      const base = urlPath(homepage);
      // Shared services and multi-location sites require a matching hall-specific path.
      const campaignService = /(^|\.)(bseennow\.net|bingomenow\.com|bcmeow\.net|airmenu\.com|tinyurl\.com|canva\.com)$/.test(host(link));
      if (campaignService) continue; // These require audited campaign identifiers in attribution.ts.
      const sharedService = /(^|\.)(facebook\.com|yelp\.com|elks\.org|google\.com|multiplayerbingo\.com|lgbtqfresno\.com)$/.test(host(link));
      const specificPath = base !== '/' && !/^\/(events?|calendar)\/?$/i.test(base);
      const queryMatches = [...homepage.searchParams].every(([key,value])=>link.searchParams.get(key)===value);
      if ((sameHost.length === 1 && !sharedService) || (specificPath && queryMatches && (urlPath(link) === base || urlPath(link).startsWith(base + '/')))) add(h.id, 'known_link', link.href);
    }
  }
  const identifiedIds = [...new Set(evidence.map(e => e.hallId))];
  const conflictingOperator = [...unresolvedOperatorIds].some(id => !identifiedIds.includes(id)) && identifiedIds.length && !identifiedIds.every(id => unresolvedOperatorIds.has(id));
  const single = identifiedIds.length === 1 && !conflictingOperator;
  const candidates = [...new Set([...identifiedIds, ...(!identifiedIds.length || conflictingOperator ? unresolvedOperatorIds : [])])];
  const reason = single ? 'One hall matched message content or a known link.'
    : identifiedIds.length > 1 || conflictingOperator ? 'Multiple halls or conflicting clues appear; review before assigning.'
    : unresolvedOperatorIds.size ? 'Operator identified, but no unique location is specified.'
    : 'No recognized hall name or hall-specific link; review required.';
  return {
    messageId: message.messageId || null,
    fingerprint: crypto.createHash('sha256').update(JSON.stringify([sender, message.to || null, receivedAt, message.body])).digest('hex'),
    from: sender, to: message.to || null, receivedAt, body: message.body,
    status: single ? 'classified' : 'needs_review',
    confidence: single ? 'high_rule_match' : 'unresolved',
    hallId: single ? identifiedIds[0] : null,
    hallName: single ? byId.get(identifiedIds[0]).name : null,
    candidateHallIds: candidates, operators: detectedOperators, evidence, reason,
    senderSubscriptions: halls.filter(h => h.signup?.destination && senderKey(h.signup.destination) === sender).map(h => ({hallId:h.id,keyword:h.signup.keyword,enrollmentStatus:h.enrollmentStatus})),
    parserVersion: 1
  };
}
