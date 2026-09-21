const referenceArt = `${import.meta.env.BASE_URL}art/reference-ui.png`;

/** Display a bounded piece of the supplied artwork without baking game state into it. */
export function referencePiece(viewBox: string, className: string, clip?: string) {
  return `<svg class="${className}" viewBox="${viewBox}" aria-hidden="true"><image href="${referenceArt}" width="941" height="1672" ${clip ? `style="clip-path:path('${clip}')"` : ''}/></svg>`;
}

export const symbols = `<defs>
 <linearGradient id="stone-fill" x2=".4" y2="1"><stop stop-color="#bcc5b7"/><stop offset="1" stop-color="#718c8c"/></linearGradient>
 <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M1 1L5 3L1 5" fill="none" stroke="#fffbe4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker>
 <symbol id="lily" viewBox="294 525 120 115">
  <image href="${referenceArt}" width="941" height="1672" style="clip-path:path('M350 533Q317 533 305 558Q294 581 306 603Q320 626 350 626Q380 629 397 607Q407 593 404 574L372 577L400 562Q392 544 377 541L372 551L377 535Z')"/>
 </symbol>
 <symbol id="frog-art" viewBox="48 658 108 108">
  <image href="${referenceArt}" width="941" height="1672" style="clip-path:path('M67 704Q70 686 84 683Q87 670 99 670L115 676Q121 660 133 669Q145 674 144 690L147 707L137 723L136 743L146 751L133 754L124 746L108 751L103 758L94 750L83 753L72 749L64 752L55 744L61 735Q47 716 58 707Z')"/>
 </symbol>
 <symbol id="island" viewBox="-50 -50 100 100">
  <ellipse cy="17" rx="47" ry="31" fill="#33777b" opacity=".22"/>
  <path d="M-46-6Q-45-26-18-28Q12-35 37-15Q52 1 42 22Q20 40-18 32Q-48 26-46-6" fill="#cba66b" stroke="#b89666" stroke-width="2"/>
  <path d="M-46-12Q-40-33-12-32Q22-34 41-14Q51 0 40 16Q15 31-20 22Q-49 16-46-12" fill="#dfe29a" stroke="#a8b86a" stroke-width="2"/>
  <path d="M-40-4Q-20-26 1-24M16 20L29 17" fill="none" stroke="#f2edbc" stroke-width="4" stroke-linecap="round"/>
  <g stroke="#8da957" stroke-width="2" stroke-linecap="round"><path d="M-34 11L-36 3M-34 11L-29 5M31 3L30-5M31 3L36-2"/></g>
 </symbol>
 <symbol id="home-art" viewBox="787 613 150 180">
  <image href="${referenceArt}" width="941" height="1672" style="clip-path:path('M790 707L804 680L809 656L842 636L875 631L885 614L895 617L890 637L926 655L934 695L930 723L939 751L936 774L902 789L855 786L823 774L801 747Z')"/>
 </symbol>
 <symbol id="rock-art" viewBox="-50 -50 100 100">
  <ellipse cy="21" rx="44" ry="21" fill="#286a75" opacity=".23"/>
  <path d="M-43 9L-30-21L-7-35L22-28L42-5L37 23L5 32L-28 26Z" fill="url(#stone-fill)" stroke="#678789" stroke-width="3"/>
  <path d="M-30-19L-7-32L19-25L9-7L-12-3Z" fill="#d0d5c2" opacity=".75"/>
  <path d="M-12-3L-25 20M9-7L30 4L36 21" fill="none" stroke="#789493" stroke-width="2"/>
  <path d="M-28 20Q-11 10 0 28" stroke="#a0bd75" stroke-width="6" fill="none" stroke-linecap="round"/>
 </symbol>
</defs>`;
export function icon(name: string, cls = '') {
  const paths: Record<string, string> = {
    undo: '<path d="M9 7L4 12L9 17M4 12H14A6 6 0 0 1 14 24H12"/>',
    restart: '<path d="M24 11A10 10 0 1 0 25 20M24 4V11H17"/>',
    hint: '<path d="M11 22C11 18 7 17 7 12A9 9 0 1 1 25 12C25 17 21 18 21 22ZM12 26H20M14 30H18"/>',
    menu: '<path d="M11 7V25M21 7V25"/>',
    close: '<path d="M9 9L23 23M23 9L9 23"/>',
    arrow: '<path d="M6 16H26M19 9L26 16L19 23"/>',
    check: '<path d="M7 16L13 22L25 10"/>',
    lock: '<rect x="8" y="14" width="16" height="13" rx="4"/><path d="M11 14V10A5 5 0 0 1 21 10V14"/>',
    sound: '<path d="M5 13H10L17 7V25L10 19H5ZM22 11Q28 16 22 21"/>',
  };
  return `<svg class="icon ${cls}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.hint}</svg>`;
}
export const miniFrog = `<svg viewBox="-50 -60 100 110" aria-hidden="true">${symbols}<use href="#frog-art" x="-50" y="-60" width="100" height="110"/></svg>`;
