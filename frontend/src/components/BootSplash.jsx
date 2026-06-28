import React, { useEffect, useRef, useState } from "react";

/**
 * HD Market CG — animated launch / boot splash screen.
 *
 * Named BootSplash to avoid collision with the existing admin-configurable promo
 * SplashScreen (src/components/SplashScreen.jsx). Self-contained: injects its own
 * CSS, vectorized SVG, no external deps.
 *
 * Usage:
 *   {showBootSplash && <BootSplash onDone={() => setShowBootSplash(false)} />}
 * or simply mount it and let it auto-dismiss after `minDuration` ms.
 *
 * Props:
 *   onDone       () => void   called once the leave transition finishes
 *   minDuration  number (ms)  how long the splash stays before leaving (default 2400)
 *   waitUntil    boolean      keep visible while true (e.g. app still loading); when it
 *                             turns false AND minDuration elapsed, the splash leaves.
 */
export default function BootSplash({ onDone, minDuration = 2400, waitUntil = false }) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const elapsed = useRef(false);
  const blocking = useRef(waitUntil);

  useEffect(() => { blocking.current = waitUntil; maybeLeave(); }, [waitUntil]);

  function maybeLeave() {
    if (elapsed.current && !blocking.current && !leaving) setLeaving(true);
  }
  useEffect(() => {
    const t = setTimeout(() => { elapsed.current = true; maybeLeave(); }, minDuration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTransitionEnd() {
    if (leaving) { setGone(true); onDone && onDone(); }
  }
  if (gone) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      <div
        className={"hdsplash" + (leaving ? " is-leaving" : "")}
        onTransitionEnd={handleTransitionEnd}
        role="status"
        aria-label="Chargement de HD Market CG"
      >
        <div className="amb amb1" />
        <div className="amb amb2" />
        <div className="hd-logo-wrap" dangerouslySetInnerHTML={{ __html: LOGO_MARKUP }} />
        <div className="bottom">
          <div className="dots"><span className="dot" /><span className="dot" /><span className="dot" /></div>
          <div className="rule" />
          <div className="hd-tag-wrap" dangerouslySetInnerHTML={{ __html: TAG_MARKUP }} />
        </div>
      </div>
    </>
  );
}

const LOGO_MARKUP = `<svg class="logo" viewBox="0 0 600 560" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="HD market CG"><g class="s-bag"><g transform="translate(300,200) scale(2.0) translate(-100,-116)">
    <path d="M 67,82 A 14,24 0 0 1 95,82" fill="none" stroke="#FFFFFF" stroke-width="13" stroke-linecap="round"/>
    <path d="M 105,82 A 14,24 0 0 1 133,82" fill="none" stroke="#FFFFFF" stroke-width="13" stroke-linecap="round"/>
    <path d="M 56.79,94.69 L 56.79,94.69 Q 60.00,78.00 77.00,78.00 L 123.00,78.00 Q 140.00,78.00 143.21,94.69 L 156.79,165.31 Q 160.00,182.00 143.00,182.00 L 57.00,182.00 Q 40.00,182.00 43.21,165.31 Z" fill="#FFFFFF"/>
    <path d="M65 442H240V1Q229 -2 206.0 -5.0Q183 -8 159 -8Q107 -8 86.0 10.5Q65 29 65 75ZM240 211H65V608Q77 610 100.5 613.5Q124 617 146 617Q196 617 218.0 600.0Q240 583 240 534ZM432 442H607V1Q596 -2 573.0 -5.0Q550 -8 526 -8Q474 -8 453.0 10.5Q432 29 432 75ZM607 211H432V608Q444 610 467.5 613.5Q491 617 513 617Q563 617 585.0 599.0Q607 581 607 532ZM533 234H140V372H533Z" transform="translate(60.360,152.000) scale(0.06000,-0.06000)" fill="#FF5000"/>
<path d="M451 301Q451 213 407.5 169.0Q364 125 296 125Q283 125 266.5 126.5Q250 128 239 130V478Q254 480 268.5 481.0Q283 482 297 482Q344 482 378.5 461.5Q413 441 432.0 401.0Q451 361 451 301ZM631 304Q631 413 587.5 483.5Q544 554 466.5 588.5Q389 623 285 623Q247 623 199.0 618.5Q151 614 108 600Q89 593 77.0 581.5Q65 570 65 549V82Q65 30 120 9Q160 -6 210.5 -11.0Q261 -16 295 -16Q396 -16 471.5 19.5Q547 55 589.0 126.0Q631 197 631 304Z" transform="translate(100.180,152.000) scale(0.06000,-0.06000)" fill="#FF5000"/>
</g></g><g class="s-word"><path d="M477 327V213H354V313Q354 352 330.5 370.5Q307 389 271 389Q245 389 223.5 381.5Q202 374 187 364V213H64V372Q64 396 74.0 411.5Q84 427 104 440Q135 461 180.5 474.0Q226 487 275 487Q324 487 365.0 472.0Q406 457 432 428Q439 422 445.0 416.0Q451 410 455 402Q464 387 470.5 367.5Q477 348 477 327ZM766 317V213H643V313Q643 352 621.0 370.5Q599 389 562 389Q535 389 509.5 378.0Q484 367 466 349L404 424Q435 450 477.0 468.5Q519 487 577 487Q630 487 673.0 470.0Q716 453 741.0 415.0Q766 377 766 317ZM64 261H187V2Q179 -1 164.0 -3.5Q149 -6 131 -6Q97 -6 80.5 6.5Q64 19 64 51ZM354 261H477V2Q469 -1 453.5 -3.5Q438 -6 421 -6Q386 -6 370.0 6.5Q354 19 354 51ZM643 261H766V2Q759 -1 743.5 -3.5Q728 -6 711 -6Q676 -6 659.5 6.5Q643 19 643 51Z" transform="translate(70.254,472.000) scale(0.09600,-0.09600)" fill="#FFFFFF"/>
<path d="M250 79Q280 79 304.0 85.0Q328 91 339 98V212L240 202Q199 199 177.5 184.5Q156 170 156 142Q156 113 179.0 96.0Q202 79 250 79ZM245 487Q343 487 401.0 445.5Q459 404 459 315V85Q459 61 447.5 47.0Q436 33 418 22Q390 6 347.0 -4.5Q304 -15 250 -15Q150 -15 93.0 23.5Q36 62 36 138Q36 205 78.5 240.5Q121 276 202 284L338 298V316Q338 356 310.5 374.0Q283 392 233 392Q194 392 157.0 382.0Q120 372 91 358Q81 366 73.0 380.0Q65 394 65 409Q65 445 105 462Q133 475 170.5 481.0Q208 487 245 487Z" transform="translate(150.530,472.000) scale(0.09600,-0.09600)" fill="#FFFFFF"/>
<path d="M187 360V223H64V370Q64 395 76.0 412.5Q88 430 110 445Q140 463 186.0 475.0Q232 487 285 487Q379 487 379 429Q379 415 375.0 403.5Q371 392 365 383Q355 385 340.0 386.5Q325 388 308 388Q272 388 240.5 380.5Q209 373 187 360ZM64 264 187 258V2Q179 -1 164.0 -3.5Q149 -6 131 -6Q97 -6 80.5 6.5Q64 19 64 51Z" transform="translate(201.046,472.000) scale(0.09600,-0.09600)" fill="#FFFFFF"/>
<path d="M245 199 159 256 386 482Q423 481 445.0 464.5Q467 448 467 422Q467 401 452.5 384.0Q438 367 409 342ZM162 238 257 283 490 64Q487 31 470.0 12.0Q453 -7 423 -7Q400 -7 381.0 4.5Q362 16 342 40ZM66 266 189 260V2Q181 -1 166.0 -3.5Q151 -6 133 -6Q99 -6 82.5 6.5Q66 19 66 51ZM189 197 66 203V650Q74 652 89.0 655.0Q104 658 122 658Q157 658 173.0 645.5Q189 633 189 601Z" transform="translate(239.562,472.000) scale(0.09600,-0.09600)" fill="#FFFFFF"/>
<path d="M118 174 113 260 381 300Q378 338 352.0 366.0Q326 394 276 394Q225 394 191.0 358.5Q157 323 156 257L159 205Q168 141 208.5 111.0Q249 81 311 81Q353 81 389.0 93.5Q425 106 446 121Q460 112 468.5 98.5Q477 85 477 69Q477 43 454.0 24.5Q431 6 392.0 -4.0Q353 -14 303 -14Q226 -14 166.5 14.5Q107 43 73.5 100.0Q40 157 40 242Q40 303 59.0 349.0Q78 395 110.5 425.5Q143 456 186.0 471.5Q229 487 276 487Q342 487 391.5 460.5Q441 434 469.5 387.0Q498 340 498 279Q498 251 483.5 237.5Q469 224 443 221Z" transform="translate(289.982,472.000) scale(0.09600,-0.09600)" fill="#FFFFFF"/>
<path d="M65 264H188V146Q188 113 207.5 99.0Q227 85 263 85Q279 85 297.5 89.0Q316 93 329 99Q336 91 342.0 80.0Q348 69 348 53Q348 24 320.5 5.0Q293 -14 235 -14Q156 -14 110.5 21.5Q65 57 65 137ZM140 366V463H336Q340 456 344.5 443.0Q349 430 349 416Q349 391 337.0 378.5Q325 366 306 366ZM188 237H65V597Q73 600 88.5 603.0Q104 606 121 606Q156 606 172.0 593.5Q188 581 188 549Z" transform="translate(341.650,472.000) scale(0.09600,-0.09600)" fill="#FFFFFF"/><path d="M541 518Q541 493 528.0 473.5Q515 454 498 443Q473 460 443.0 472.0Q413 484 374 484Q323 484 287.5 462.5Q252 441 233.5 400.5Q215 360 215 303Q215 215 259.5 169.0Q304 123 383 123Q424 123 452.5 134.0Q481 145 507 159Q524 146 533.5 126.0Q543 106 543 80Q543 57 531.0 38.0Q519 19 490 6Q472 -2 439.0 -10.0Q406 -18 359 -18Q269 -18 195.5 16.0Q122 50 78.5 121.0Q35 192 35 303Q35 407 77.0 478.5Q119 550 190.5 587.5Q262 625 348 625Q409 625 452.0 611.0Q495 597 518.0 573.0Q541 549 541 518Z" transform="translate(407.814,472.000) scale(0.09792,-0.09792)" fill="#FFFFFF"/>
<path d="M614 303V97Q614 66 603.0 51.0Q592 36 568 22Q540 6 486.5 -6.0Q433 -18 380 -18Q284 -18 205.5 15.0Q127 48 81.0 119.0Q35 190 35 302Q35 407 81.5 479.0Q128 551 206.5 588.0Q285 625 382 625Q445 625 491.5 611.5Q538 598 563.0 573.5Q588 549 588 516Q588 491 575.0 471.5Q562 452 545 441Q520 456 482.0 470.0Q444 484 395 484Q342 484 301.0 461.5Q260 439 237.5 398.5Q215 358 215 303Q215 243 236.5 202.5Q258 162 296.0 142.0Q334 122 383 122Q405 122 421.5 126.5Q438 131 447 135V231H340Q334 242 328.5 260.0Q323 278 323 298Q323 334 339.5 350.0Q356 366 382 366H551Q581 366 597.5 349.5Q614 333 614 303Z" transform="translate(464.227,472.000) scale(0.09792,-0.09792)" fill="#FFFFFF"/></g></svg>`;
const TAG_MARKUP = `<svg class="tag" viewBox="0 0 211 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M71 423H223V1Q214 -2 194.0 -4.5Q174 -7 153 -7Q108 -7 89.5 9.0Q71 25 71 65ZM223 231H71V608Q81 610 101.5 613.0Q122 616 141 616Q185 616 204.0 601.0Q223 586 223 544ZM444 423H597V1Q587 -2 567.0 -4.5Q547 -7 526 -7Q481 -7 462.5 9.0Q444 25 444 65ZM597 231H444V608Q455 610 475.0 613.0Q495 616 515 616Q558 616 577.5 600.5Q597 585 597 543ZM531 244H140V365H531Z" transform="translate(0.000,42.000) scale(0.04400,-0.04400)" fill="#FFFFFF"/>
<path d="M466 303Q466 207 418.5 158.0Q371 109 292 109Q275 109 256.0 110.5Q237 112 222 115V494Q239 496 255.5 497.5Q272 499 290 499Q342 499 381.5 477.5Q421 456 443.5 413.0Q466 370 466 303ZM623 306Q623 413 580.0 483.0Q537 553 460.5 587.5Q384 622 281 622Q243 622 197.0 618.0Q151 614 111 601Q93 594 82.0 583.5Q71 573 71 553V75Q71 27 123 8Q162 -6 210.0 -10.5Q258 -15 291 -15Q391 -15 465.5 20.5Q540 56 581.5 127.0Q623 198 623 306Z" transform="translate(30.392,42.000) scale(0.04400,-0.04400)" fill="#FFFFFF"/>
<path d="M472 151Q461 142 442.5 136.0Q424 130 400 130Q369 130 348.0 138.0Q327 146 321 165Q287 260 263.5 323.0Q240 386 227 432H222Q219 369 217.0 317.0Q215 265 214.0 215.5Q213 166 211.0 115.0Q209 64 205 3Q194 0 175.5 -4.0Q157 -8 139 -8Q101 -8 79.5 5.0Q58 18 58 50Q58 72 60.5 115.5Q63 159 66.5 215.5Q70 272 73.5 335.0Q77 398 81.5 459.5Q86 521 90 573Q98 585 122.0 597.5Q146 610 188 610Q233 610 260.5 595.5Q288 581 300 548Q315 512 332.0 464.5Q349 417 365.5 368.5Q382 320 396 281H401Q429 369 458.5 453.0Q488 537 509 593Q523 601 544.5 605.5Q566 610 590 610Q633 610 659.5 597.5Q686 585 691 560Q695 541 699.5 500.0Q704 459 709.0 405.5Q714 352 719.0 293.5Q724 235 728.5 179.5Q733 124 736.0 80.0Q739 36 740 10Q725 1 708.5 -3.5Q692 -8 667 -8Q635 -8 612.5 4.0Q590 16 588 50Q583 128 580.0 198.5Q577 269 575.5 327.5Q574 386 572 428H567Q554 385 530.5 319.5Q507 254 472 151Z" transform="translate(60.564,42.000) scale(0.04400,-0.04400)" fill="#FFFFFF"/>
<path d="M255 95Q278 95 300.5 99.5Q323 104 333 110V206L249 198Q215 196 195.0 184.0Q175 172 175 148Q175 124 194.0 109.5Q213 95 255 95ZM249 495Q353 495 415.0 451.5Q477 408 477 317V90Q477 65 464.0 49.5Q451 34 431 23Q401 5 356.5 -5.5Q312 -16 255 -16Q153 -16 92.5 24.0Q32 64 32 143Q32 211 74.0 247.5Q116 284 199 292L332 306V318Q332 352 305.5 367.0Q279 382 230 382Q192 382 155.5 373.0Q119 364 90 352Q78 360 69.5 376.5Q61 393 61 411Q61 453 107 472Q136 484 174.5 489.5Q213 495 249 495Z" transform="translate(96.456,42.000) scale(0.04400,-0.04400)" fill="#FFFFFF"/>
<path d="M206 351V226H58V369Q58 397 71.5 416.5Q85 436 109 451Q142 471 188.5 482.5Q235 494 286 494Q388 494 388 426Q388 410 383.5 396.0Q379 382 373 372Q363 374 348.5 375.5Q334 377 317 377Q287 377 257.0 370.0Q227 363 206 351ZM58 264 206 261V1Q196 -2 178.0 -4.5Q160 -7 139 -7Q97 -7 77.5 8.0Q58 23 58 62Z" transform="translate(120.908,42.000) scale(0.04400,-0.04400)" fill="#FFFFFF"/>
<path d="M272 192 165 260 391 488Q436 487 463.5 467.0Q491 447 491 417Q491 391 473.0 370.5Q455 350 418 318ZM171 239 289 291 510 77Q506 37 486.0 14.5Q466 -8 429 -8Q402 -8 379.5 5.5Q357 19 332 50ZM60 265 208 262V1Q198 -2 180.0 -4.5Q162 -7 141 -7Q99 -7 79.5 8.0Q60 23 60 62ZM208 185 60 188V651Q69 654 87.0 657.0Q105 660 126 660Q169 660 188.5 645.0Q208 630 208 590Z" transform="translate(139.684,42.000) scale(0.04400,-0.04400)" fill="#FFFFFF"/>
<path d="M127 170 121 270 369 309Q367 337 345.0 361.0Q323 385 280 385Q235 385 205.0 354.5Q175 324 173 268L178 199Q187 144 225.0 120.5Q263 97 315 97Q357 97 394.0 109.0Q431 121 454 134Q469 125 478.5 109.0Q488 93 488 75Q488 45 464.5 25.0Q441 5 399.5 -5.0Q358 -15 305 -15Q228 -15 166.5 14.0Q105 43 70.0 101.0Q35 159 35 246Q35 310 55.5 357.0Q76 404 110.5 434.5Q145 465 188.5 480.0Q232 495 279 495Q348 495 399.5 467.5Q451 440 480.0 393.0Q509 346 509 284Q509 253 492.0 237.0Q475 221 445 217Z" transform="translate(164.400,42.000) scale(0.04400,-0.04400)" fill="#FFFFFF"/>
<path d="M59 264H206V157Q206 129 224.0 116.0Q242 103 275 103Q290 103 307.5 106.5Q325 110 337 115Q345 106 351.5 93.0Q358 80 358 63Q358 29 330.0 7.0Q302 -15 236 -15Q152 -15 105.5 23.0Q59 61 59 147ZM153 355V469H345Q350 461 355.0 446.0Q360 431 360 413Q360 383 346.5 369.0Q333 355 310 355ZM206 239H59V598Q69 601 87.0 604.5Q105 608 125 608Q168 608 187.0 593.0Q206 578 206 538Z" transform="translate(189.248,42.000) scale(0.04400,-0.04400)" fill="#FFFFFF"/></svg>`;
const SPLASH_CSS = `
.hdsplash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;overflow:hidden;
  background:linear-gradient(180deg,#FF6E1F 0%,#F23E00 100%);
  font-family:system-ui,-apple-system,sans-serif;
  transition:opacity .45s ease,visibility .45s ease;}
.hdsplash.is-leaving{opacity:0;visibility:hidden;}

.hdsplash .amb{position:absolute;border-radius:50%;background:#fff;pointer-events:none;will-change:transform;}
.hdsplash .amb1{width:48vw;height:48vw;left:-9vw;top:5vh;opacity:.07;animation:hd-float1 9s ease-in-out infinite;}
.hdsplash .amb2{width:62vw;height:62vw;right:-15vw;bottom:0;opacity:.06;animation:hd-float2 11s ease-in-out infinite;}

.hdsplash .logo{width:min(58vw,300px);height:auto;overflow:visible;}
.hdsplash .s-bag{transform-box:fill-box;transform-origin:50% 50%;
  animation:hd-pop .72s cubic-bezier(.2,.86,.3,1.5) .12s both, hd-bob 3.4s ease-in-out 1.1s infinite;}
.hdsplash .s-word{transform-box:fill-box;transform-origin:50% 50%;
  animation:hd-rise .6s cubic-bezier(.2,.7,.25,1) .58s both;}

.hdsplash .bottom{position:absolute;bottom:6.5vh;display:flex;flex-direction:column;
  align-items:center;gap:18px;animation:hd-rise2 .6s ease-out 1.05s both;}
.hdsplash .dots{display:flex;gap:12px;}
.hdsplash .dot{width:11px;height:11px;border-radius:50%;background:#fff;
  animation:hd-bounce 1s ease-in-out infinite;}
.hdsplash .dot:nth-child(2){animation-delay:.16s;}
.hdsplash .dot:nth-child(3){animation-delay:.32s;}
.hdsplash .rule{width:70px;height:3px;border-radius:2px;background:rgba(255,255,255,.55);}
.hdsplash .tag{width:150px;height:auto;display:block;opacity:.92;}

@keyframes hd-pop{0%{opacity:0;transform:translateY(46px) scale(.5)}55%{opacity:1}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes hd-rise{from{opacity:0;transform:translateY(52px)}to{opacity:1;transform:translateY(0)}}
@keyframes hd-rise2{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes hd-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes hd-bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-11px);opacity:1}}
@keyframes hd-float1{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(26px) scale(1.05)}}
@keyframes hd-float2{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-30px) scale(1.06)}}

@media (prefers-reduced-motion:reduce){
  .hdsplash *{animation:none!important}
  .hdsplash .s-bag,.hdsplash .s-word,.hdsplash .bottom,.hdsplash .dot{opacity:1!important;transform:none!important}
}

.hdsplash .hd-logo-wrap{display:contents}.hdsplash .hd-tag-wrap{display:contents}`;
