import type { Notice } from './types';

/** Error carrying a translation key instead of a language-bound message. */
export class NoticeError extends Error {
  readonly notice: Notice;

  constructor(notice: Notice) {
    super(notice.key);
    this.name = 'NoticeError';
    this.notice = notice;
  }
}

export const noticeOf = (err: unknown): Notice =>
  err instanceof NoticeError ? err.notice : { key: 'err.unknown', params: { msg: String(err) } };
