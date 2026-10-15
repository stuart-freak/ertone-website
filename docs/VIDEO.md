# Home hero video

The hero loop is built from five landscape stills with slow zooms and pans and one second cross fades. It is 21 seconds, 1280x720, silent, about 2MB as MP4 and 1.5MB as WebM.

1. Put five stills in `src/video-src/` named v1.png to v5.png. v1 is also the first and last frame, so the loop is seamless.
2. Run `python3 tools/make_hero_video.py`.
3. Rebuild the site.

Real footage is better when Ertone has it. A 15 to 20 second landscape clip of a press cycling can replace the file directly. Keep it under 4MB, muted, 1280 or 1920 wide, then export both MP4 (H.264) and WebM (VP9).
