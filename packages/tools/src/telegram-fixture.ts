// The HTML of a public channel preview, written by hand for the tests of the Telegram tool.

export interface FixturePost {
  readonly id: number;
  readonly date: string;
  /** The text as the preview draws it: HTML. */
  readonly html: string;
  readonly photo?: boolean;
  readonly linkCard?: boolean;
  readonly edited?: boolean;
  readonly forwardFrom?: string;
}

/** A post with a line break, an emoji, a link, a photo, a forward origin and a mark of an edit. */
export const PHOTO_POST: FixturePost = {
  id: 2042,
  date: '2026-10-01T12:00:00+00:00',
  html:
    'A hull at the Kozmino berth.<br/>Second line <i class="emoji" ' +
    `style="background-image:url('//telegram.org/img/emoji/40/F09F9AA2.png')"><b>\u{1F6A2}</b></i>` +
    ' <a href="http://example.com/notice" target="_blank" rel="noopener">example.com/notice</a>',
  photo: true,
  edited: true,
  forwardFrom: 'origin_channel',
};

/** A post with a link card, which is no media. */
export const LINK_POST: FixturePost = {
  id: 2043,
  date: '2026-10-01T14:30:05+00:00',
  html:
    'Port notice: <a href="https://port.example/notice/7" target="_blank" ' +
    'rel="noopener">https://port.example/notice/7</a>',
  linkCard: true,
};

/** A post with a photo and no text. */
export const SILENT_POST: FixturePost = {
  id: 2041,
  date: '2026-10-01T09:00:00+00:00',
  html: '',
  photo: true,
};

const messageOf = (handle: string, post: FixturePost): string =>
  `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="${handle}/${post.id}">` +
  '<div class="tgme_widget_message_bubble">' +
  (post.forwardFrom === undefined
    ? ''
    : `<div class="tgme_widget_message_forwarded_from">Forwarded from <a class="tgme_widget_message_forwarded_from_name" href="https://t.me/${post.forwardFrom}/9">Origin</a></div>`) +
  (post.photo === true
    ? `<a class="tgme_widget_message_photo_wrap" href="https://t.me/${handle}/${post.id}" style="background-image:url('https://cdn.example/photo${post.id}.jpg')"></a>`
    : '') +
  (post.html === ''
    ? ''
    : `<div class="tgme_widget_message_text js-message_text" dir="auto">${post.html}</div>`) +
  (post.linkCard === true
    ? '<a class="tgme_widget_message_link_preview" href="https://port.example/notice/7"><div class="link_preview_description js-message_text">A card of the link</div></a>'
    : '') +
  '<div class="tgme_widget_message_info"><span class="tgme_widget_message_meta">' +
  (post.edited === true ? '<span class="tgme_widget_message_edited">edited</span> ' : '') +
  `<a class="tgme_widget_message_date" href="https://t.me/${handle}/${post.id}"><time datetime="${post.date}" class="time">12:00</time></a>` +
  '</span></div></div></div></div>';

/** One page of the preview of a channel, with its posts in the order given. */
export const previewPage = (handle: string, posts: readonly FixturePost[]): string =>
  '<html><head><title>Preview</title></head><body>' +
  `<div class="tgme_channel_info"><div class="tgme_channel_info_header_title">A test channel</div><div class="tgme_channel_info_header_username">@${handle}</div></div>` +
  `<section class="tgme_channel_history">${posts.map((post) => messageOf(handle, post)).join('')}</section>` +
  '</body></html>';

/** What t.me gives for a handle that names no public channel. */
export const NO_CHANNEL_PAGE =
  '<html><head><title>Telegram: Contact @nobody</title></head><body><div class="tgme_page">If you have Telegram, you can contact @nobody right away.</div></body></html>';
