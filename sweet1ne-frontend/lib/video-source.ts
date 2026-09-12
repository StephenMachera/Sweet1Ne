/**
 * Picking a video encode by screen size.
 *
 * `<source media="…">` can't do this: Chrome and Firefox ignore `media` on a
 * <source> inside <video> (it only works inside <picture>), so they'd always
 * take whichever file is listed first. So the choice is made in script —
 * once inline in the server HTML, so the request starts during parsing, and
 * once from React's ref, for client-side navigation where there's no HTML.
 * Both read the same query, so they can never disagree.
 */

export const MOBILE_VIDEO_QUERY = "(max-width: 720px)";

export type VideoEncodes = { video: string; videoMobile: string };

export function pickVideoSource({ video, videoMobile }: VideoEncodes) {
  return window.matchMedia(MOBILE_VIDEO_QUERY).matches ? videoMobile : video;
}

/** The same choice as a self-contained inline script for the server HTML —
 *  to be placed immediately after the <video> it sets. */
export function pickVideoSourceScript({ video, videoMobile }: VideoEncodes) {
  return (
    "(function(){var s=document.currentScript,v=s&&s.previousElementSibling;" +
    'if(!v||v.tagName!=="VIDEO")return;' +
    `v.src=matchMedia(${JSON.stringify(MOBILE_VIDEO_QUERY)}).matches?` +
    `${JSON.stringify(videoMobile)}:${JSON.stringify(video)};})()`
  );
}
