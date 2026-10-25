/* StoryFlow Studio 3.0.0 — Supporto Desktop + Mobile Touch + App Native Bridge */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('storyCanvas');
  const ctx = canvas.getContext('2d');
  const siteUrl = $('siteUrl');
  const inpTitle = $('inpTitle');
  const rngFontSize = $('rngFontSize');
  const rngTextY = $('rngTextY');
  const rngZoom = $('rngZoom');
  const chkGuide = $('chkGuide');
  const cfgColor = $('cfgColor');
  const cfgDarkColor = $('cfgDarkColor');
  const cfgBackgroundEnabled = $('cfgBackgroundEnabled');
  const cfgBackgroundTint = $('cfgBackgroundTint');
  const cfgBackgroundPosition = $('cfgBackgroundPosition');
  const cfgPattern = $('cfgPattern');
  const cfgTitleFont = $('cfgTitleFont');
  const cfgCtaFont = $('cfgCtaFont');
  const cfgTitleWeight = $('cfgTitleWeight');
  const cfgCtaWeight = $('cfgCtaWeight');
  const cfgCtaText = $('cfgCtaText');
  const cfgStickerText = $('cfgStickerText');
  const cfgMetaTarget = $('cfgMetaTarget');
  const cfgGeminiKey = $('cfgGeminiKey');
  const cfgAiModel = $('cfgAiModel');
  const cfgWatermarkEnabled = $('cfgWatermarkEnabled');
  const cfgWatermarkOpacity = $('cfgWatermarkOpacity');
  const cfgWatermarkSize = $('cfgWatermarkSize');
  const cfgWatermarkPosition = $('cfgWatermarkPosition');
  const STORE_KEY = 'storyflow.studio.settings.v2.2';
  const AI_STORE_KEY = 'storyflow.studio.ai.v1';

  const isNativeApp = () => Boolean(window.StoryFlowNative && typeof window.StoryFlowNative.startQueue === 'function');
  const nativePlatform = () => {
    try { return typeof window.StoryFlowNative.getPlatform === 'function' ? window.StoryFlowNative.getPlatform() : 'android'; }
    catch (_) { return 'android'; }
  };

  const FONTS = [
    'Montserrat','Big Shoulders Display','Bai Jamjuree','Sofia Sans','Voltaire',
    'Bricolage Grotesque','Roboto Condensed','Oswald','Anton','Bebas Neue',
    'Barlow Condensed','Archivo Narrow','Teko','Saira Condensed','IBM Plex Sans Condensed',
    'Fjalla One','Rajdhani','Kanit','Titillium Web','Poppins','Inter',
    'Rubik','Outfit','Manrope','PT Sans Narrow','League Gothic',
    'Roboto','Lato','Nunito Sans','DM Sans','Barlow','Dosis'
  ];
  const STANDARD_WEIGHTS = [400,500,600,700,800,900];
  const WEIGHT_LABELS = { 400:'Regular',500:'Medium',600:'Semi Bold',700:'Bold',800:'Extra Bold',900:'Black' };
  const FONT_WEIGHTS = {
    'Voltaire':[400], 'Anton':[400], 'Bebas Neue':[400], 'Fjalla One':[400], 'League Gothic':[400],
    'Bai Jamjuree':[400,500,600,700], 'Oswald':[400,500,600,700], 'Teko':[400,500,600,700],
    'Rajdhani':[400,500,600,700], 'Bricolage Grotesque':[400,500,600,700,800],
    'Manrope':[400,500,600,700,800], 'Dosis':[400,500,600,700,800], 'PT Sans Narrow':[400,700], 'Lato':[400,700,900]
  };
  const availableWeights = name => FONT_WEIGHTS[name] || STANDARD_WEIGHTS;
  const nearestWeight = (name,requested) => {
    const options=availableWeights(name), n=Number(requested);
    if (!Number.isFinite(n)) return options.includes(800) ? 800 : options[options.length-1];
    return options.reduce((best,w)=>Math.abs(w-n)<Math.abs(best-n)?w:best,options[0]);
  };
  const PATTERNS = [
    ['halftone','Pois classici'],['none','Senza pattern'],['fine-dots','Micro pois'],
    ['big-dots','Pois grandi'],['grid','Griglia'],['micro-grid','Micro griglia'],
    ['diagonal','Linee diagonali'],['crosshatch','Reticolo'],['vertical','Righe verticali'],
    ['horizontal','Righe orizzontali'],['chevrons','Chevron'],['triangles','Triangoli'],
    ['diamonds','Rombi'],['circles','Anelli'],['waves','Onde'],['bricks','Mattoni'],
    ['confetti','Coriandoli'],['stars','Stelle'],['plus','Croci'],['dashes','Trattini'],
    ['pixels','Pixel'],['zigzag','Zig zag'],['mesh','Maglia'],['rays','Raggi']
  ];
  const PATTERN_IDS = new Set(PATTERNS.map(a => a[0]));
  // "Mi sento fortunato": abbinamenti di colori collaudati (squadre, scuderie, classici del design),
  // usati come preset nascosti. Formato: [nome, colore aree scure, colore del brand].
  // Ogni coppia rispetta LUCKY_CONTRAST: titolo bianco leggibile sul colore scuro e barra CTA leggibile.
  const LUCKY_PALETTES = [
    // NBA
    ['Lakers','#552583','#FDB927'],['Celtics','#007A33','#FFFFFF'],['Bulls','#000000','#CE1141'],
    ['Warriors','#1D428A','#FFC72C'],['Suns','#1D1160','#E56020'],['Heat','#000000','#F9A01B'],
    ['Spurs','#000000','#C4CED4'],['Nuggets','#0E2240','#FEC524'],['Bucks','#00471B','#EEE1C6'],
    ['Jazz','#002B5C','#F9A01B'],['Knicks','#0B2240','#F58426'],['Thunder','#002D62','#EF3B24'],
    ['Magic','#000000','#0077C0'],['Cavaliers','#860038','#FDBB30'],
    // NFL
    ['Steelers','#101820','#FFB612'],['Packers','#203731','#FFB612'],['Raiders','#000000','#A5ACAF'],
    ['Bears','#0B162A','#C83803'],['Broncos','#002244','#FB4F14'],['Vikings','#4F2683','#FFC62F'],
    ['Seahawks','#002244','#69BE28'],['Cowboys','#041E42','#869397'],['Bengals','#000000','#FB4F14'],
    ['Ravens','#241773','#9E7C0C'],['Saints','#101820','#D3BC8D'],['Patriots','#002244','#B0B7BC'],
    ['Chargers','#002A5E','#FFC20E'],['Rams','#003594','#FFD100'],
    // MLB
    ['Yankees','#0C2340','#FFFFFF'],['Dodgers','#005A9C','#FFFFFF'],['Giants','#27251F','#FD5A1E'],
    ['Tigers','#0C2340','#FA4616'],['Orioles','#000000','#DF4601'],['Padres','#2F241D','#FFC425'],
    ['Astros','#002D62','#EB6E1F'],['Athletics','#003831','#EFB21E'],
    // NHL
    ['Bruins','#000000','#FFB81C'],['Penguins','#000000','#FCB514'],['Red Wings','#CE1126','#FFFFFF'],
    ['Blackhawks','#000000','#CF0A2C'],['Kings','#111111','#A2AAAD'],['Predators','#041E42','#FFB81C'],
    ['Sabres','#003087','#FFB81C'],
    // Calcio italiano
    ['Juventus','#000000','#FFFFFF'],['Inter','#000000','#1E71B8'],['Milan','#000000','#FB090B'],
    ['Roma','#8E1F2F','#F0BC42'],['Lazio','#15366F','#87D8F7'],['Napoli','#0B2D5B','#12A0D7'],
    ['Fiorentina','#482E92','#FFFFFF'],['Torino','#8A1E03','#FFFFFF'],['Atalanta','#1E1E1E','#2A7FD0'],
    ['Parma','#1B4094','#FFD200'],['Verona','#002F6C','#FFD100'],['Palermo','#111111','#F5A3C7'],
    ['Venezia','#111111','#F08A1C'],['Bologna','#1A2F48','#E03A3E'],['Genoa','#002350','#E2363F'],
    // Calcio estero
    ['Aston Villa','#670E36','#95BFE5'],['West Ham','#7A263A','#1BB1E7'],['Barcellona','#A50044','#EDBB00'],
    ['Real Madrid','#00529F','#FEBE10'],['Liverpool','#C8102E','#F6EB61'],['Manchester United','#000000','#DA291C'],
    ['Arsenal','#DB0007','#FFFFFF'],['Chelsea','#034694','#FFFFFF'],['Manchester City','#1C2C5B','#6CABDD'],
    ['Tottenham','#132257','#FFFFFF'],['Newcastle','#241F20','#F1F1F1'],['Borussia Dortmund','#000000','#FDE100'],
    ['Bayern','#DC052D','#FFFFFF'],['Ajax','#D2122E','#FFFFFF'],['PSG','#004170','#FFFFFF'],
    ['Celtic','#018749','#FFFFFF'],['Boca Juniors','#103F79','#F3B229'],['Porto','#00428C','#FFFFFF'],
    ['Sporting','#00704A','#FFFFFF'],['Galatasaray','#A90432','#FDB912'],['Fenerbahce','#002D72','#FFED00'],
    ['Wolves','#231F20','#FDB913'],['Leeds','#1D428A','#FFCD00'],
    // Nazionali
    ['Italia','#0047AB','#FFFFFF'],['Brasile','#002776','#FFDF00'],['Olanda','#1B2A5C','#F36C21'],
    ['Germania','#000000','#FFCE00'],['Francia','#002395','#FFFFFF'],['Spagna','#AA151B','#F1BF00'],
    ['Messico','#006847','#FFFFFF'],['Belgio','#000000','#FAE042'],['Svezia','#006AA7','#FECC00'],
    // Motori
    ['Ferrari','#C00000','#FFF200'],['John Player Special','#000000','#C9A646'],['McLaren','#111111','#FF8000'],
    ['Mercedes','#000000','#00D2BE'],['Aston Martin','#00594F','#CEDC00'],['Lotus','#004225','#FFD700'],
    // Wrestling
    ['Raw','#0B0B0B','#E3000F'],['SmackDown','#0A1E3F','#3FA9F5'],['NXT','#111111','#F2C500'],
    ['nWo','#000000','#EDEDED'],['AEW','#0A0A0A','#C9A44C'],
    // Classici del design
    ['Bianco e nero','#111111','#FFFFFF'],['Blu notte e oro','#0A1F44','#D4AF37'],['Bordeaux e crema','#4A0E1E','#F2E3C6'],
    ['Bosco e senape','#1F3B2D','#E1AD01'],['Mezzanotte e corallo','#101935','#FF6F59'],['Antracite e lime','#222222','#B5E61D'],
    ['Prugna e pesca','#3E1F47','#FFB997'],['Petrolio e ambra','#08343E','#FFB000'],['Synthwave','#1A0B2E','#FF2E97'],
    ['Cyberpunk','#0D0221','#00F0FF'],['Terminale','#0D0D0D','#00FF41'],['Arcade','#000000','#FFE600'],
    ['Svizzero','#111111','#FF2A1A'],['Tiffany','#1A1A1A','#81D8D0'],['Carta di giornale','#1E1E1E','#F4E4C1'],
    ['Oliva e sabbia','#3B3F24','#E8D5A9'],['Vino e rosa','#3D0C11','#F4A6B7'],['Navy e mandarino','#14213D','#FCA311'],
    ['Grafite e menta','#2C3539','#98FF98'],['Oceano','#03045E','#90E0EF'],['Tramonto','#2D1E2F','#F7B32B'],
    ['Cioccolato e menta','#3E2723','#A5D6A7'],['Arancio internazionale','#111111','#FF4F00'],['Militare','#283618','#DDA15E'],
    ['Viola reale e argento','#3B1E54','#D4D4D4'],['Cobalto e limone','#0B3D91','#FFF44F'],['Smeraldo e oro','#014D3A','#E6BE5A'],
    ['Espresso e caramello','#2B1B17','#D9A066']
  ];
  const LUCKY_CONTRAST = { title:4.5, cta:3 };
  // Font stretti e font larghi: titolo e CTA usano lo stesso font oppure uno per famiglia.
  const CONDENSED_FONTS = [
    'Big Shoulders Display','Roboto Condensed','Oswald','Anton','Bebas Neue','Barlow Condensed',
    'Archivo Narrow','Teko','Saira Condensed','IBM Plex Sans Condensed','Fjalla One','PT Sans Narrow','League Gothic'
  ];
  // Voltaire esiste solo nel peso normale: troppo leggero per una combinazione casuale.
  const WIDE_FONTS = FONTS.filter(f => !CONDENSED_FONTS.includes(f) && f!=='Voltaire');
  const DEFAULT_SITE = 'https://wordpress.org/news';
  const blank = () => ({
    brandColor:'#6047e8', darkColor:'#181818', pattern:'halftone',
    titleFont:'Montserrat', ctaFont:'Montserrat', titleWeight:800, ctaWeight:800, titleSize:58, titleY:0,
    ctaText:"LEGGI L'ARTICOLO SU", stickerText:'WORDPRESS.ORG',
    watermarkEnabled:false, watermarkOpacity:35, watermarkSize:180,
    watermarkPosition:'top-right', backgroundEnabled:false, backgroundTint:55, backgroundPosition:'center'
  });
  const copy = x => JSON.parse(JSON.stringify(x));
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const safeHex = (v,fallback) => /^#[0-9a-fA-F]{6}$/.test(v||'') ? v : fallback;
  // Contrasto WCAG tra due colori #rrggbb.
  const luminance = hex => {
    const n=parseInt(hex.slice(1),16), lin=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};
    return .2126*lin(n>>16)+.7152*lin(n>>8&255)+.0722*lin(n&255);
  };
  const contrast = (a,b) => { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
  const normalizeSite = s => {
    try { const u = new URL(s.trim()); return u.protocol + '//' + u.hostname.toLowerCase() + u.pathname.replace(/\/+$/,''); }
    catch { return DEFAULT_SITE; }
  };
  const siteKey = () => normalizeSite(siteUrl.value);
  const hostnameLabel = () => {
    try { return new URL(siteKey()).hostname.replace(/^www\./,'').toUpperCase(); }
    catch { return 'SITO WEB'; }
  };
  const safeStyle = value => {
    const initial=blank(), v=value||{}, result={...initial};
    result.brandColor=safeHex(v.brandColor,initial.brandColor);
    result.darkColor=safeHex(v.darkColor,initial.darkColor);
    result.pattern=PATTERN_IDS.has(v.pattern)?v.pattern:'halftone';
    result.titleFont=FONTS.includes(v.titleFont)?v.titleFont:'Montserrat';
    result.ctaFont=FONTS.includes(v.ctaFont)?v.ctaFont:'Montserrat';
    result.titleWeight=nearestWeight(result.titleFont,v.titleWeight ?? initial.titleWeight);
    result.ctaWeight=nearestWeight(result.ctaFont,v.ctaWeight ?? initial.ctaWeight);
    result.titleSize=clamp(Number(v.titleSize)||58,36,82);
    result.titleY=clamp(Number(v.titleY)||0,-120,120);
    result.ctaText=String(v.ctaText ?? initial.ctaText).slice(0,65);
    result.stickerText=String(v.stickerText ?? initial.stickerText).slice(0,70);
    result.backgroundEnabled=!!v.backgroundEnabled;
    result.backgroundTint=clamp(Number(v.backgroundTint ?? 55),0,95);
    result.backgroundPosition=['center','top','bottom','left','right'].includes(v.backgroundPosition)?v.backgroundPosition:'center';
    result.watermarkEnabled=!!v.watermarkEnabled;
    result.watermarkOpacity=clamp(Number(v.watermarkOpacity)||35,10,100);
    result.watermarkSize=clamp(Number(v.watermarkSize)||180,80,360);
    result.watermarkPosition=['top-right','top-left','photo-right','photo-left'].includes(v.watermarkPosition)?v.watermarkPosition:'top-right';
    return result;
  };

  let store={lastSite:DEFAULT_SITE,sites:{}};
  try {
    const prev=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
    if (prev && typeof prev==='object' && prev.sites && typeof prev.sites==='object') {
      store={lastSite:prev.lastSite||DEFAULT_SITE,sites:prev.sites,demoSiteMigrated:true,demoSiteV251:true};
    }
  } catch (e) {}
  const persistStore = () => {
    try { localStorage.setItem(STORE_KEY,JSON.stringify(store)); $('saveStatus').textContent='Salvato ✓'; return true; }
    catch (e) { $('saveStatus').textContent='Memoria piena'; return false; }
  };
  const getProfile = () => {
    const id=siteKey();
    if (!store.sites[id]) {
      const style=blank(); style.stickerText=hostnameLabel();
      store.sites[id]={defaults:style,logoData:null,stories:{},metaTarget:''};
    }
    const p=store.sites[id];
    p.defaults=safeStyle(p.defaults);
    if (!p.stories || typeof p.stories!=='object') p.stories={};
    return p;
  };

  let currentArticle=null, loadedImg=null, photoPromise=Promise.resolve();
  let logoImg=null, logoPromise=Promise.resolve(), currentStyle=blank();
  let backgroundImg=null, backgroundPromise=Promise.resolve();
  let photoState={panX:0,panY:0,zoom:1}, isDragging=false, dragStart=null;
  let queue=[], articleToken=0, pendingFontLoads=new Map();

  function switchMobileTab(tabName) {
    document.body.dataset.mobileTab = tabName;
    document.querySelectorAll('.mobile-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
  }
  document.querySelectorAll('.mobile-tab-btn').forEach(b => {
    b.addEventListener('click', () => switchMobileTab(b.dataset.tab));
  });

  const cssFont = (name,px,weight=700) => `${weight} ${px}px "${FONTS.includes(name)?name:'Montserrat'}",sans-serif`;
  async function ensureFont(name,weight) {
    if (!FONTS.includes(name)) return;
    const resolved=nearestWeight(name,weight), key=`${name}:${resolved}`;
    if (!pendingFontLoads.has(key)) {
      const promise=new Promise(resolve=>{
        const link=document.createElement('link');
        let settled=false;
        const finish=()=>{if(settled)return;settled=true;renderStory();resolve();};
        link.rel='stylesheet';
        link.href=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g,'+')}:wght@${resolved}&display=swap`;
        link.onload=()=>document.fonts.load(cssFont(name,40,resolved)).then(finish).catch(finish);
        link.onerror=finish;
        setTimeout(finish,5000);
        document.head.appendChild(link);
      });
      pendingFontLoads.set(key,promise);
    }
    return pendingFontLoads.get(key);
  }
  const ensureFonts=()=>Promise.all([
    ensureFont(currentStyle.titleFont,currentStyle.titleWeight),
    ensureFont(currentStyle.ctaFont,currentStyle.ctaWeight)
  ]);

  function populateWeightSelect(select,font,value) {
    const weights=availableWeights(font);
    select.textContent='';
    weights.forEach(weight=>{
      const option=document.createElement('option');
      option.value=String(weight);
      option.textContent=weight+' · '+WEIGHT_LABELS[weight];
      select.appendChild(option);
    });
    select.value=String(nearestWeight(font,value));
  }
  const buildFontSelect = el => {
    FONTS.forEach(font => { const op=document.createElement('option');op.value=font;op.textContent=font;el.appendChild(op); });
  };
  buildFontSelect(cfgTitleFont); buildFontSelect(cfgCtaFont);
  PATTERNS.forEach(([id,name]) => {
    const option=document.createElement('option');option.value=id;option.textContent=name;cfgPattern.appendChild(option);
  });
  $('patternCount').textContent=PATTERNS.length+' stili';

  function drawPattern(context,variant,x,y,w,h,isBrand=false) {
    if (variant==='none') return;
    context.save(); context.beginPath();context.rect(x,y,w,h);context.clip();
    context.strokeStyle=isBrand?'rgba(0,0,0,.21)':'rgba(255,255,255,.11)';
    context.fillStyle=isBrand?'rgba(0,0,0,.19)':'rgba(255,255,255,.09)';
    context.lineWidth=isBrand?2.3:2;
    const X=x+w, Y=y+h;
    const dots=(sx,sy,step,radius,halftone=false) => {
      for(let cy=y+sy;cy<Y;cy+=step) for(let cx=x+sx;cx<X;cx+=step) {
        const r=halftone?3+(Math.abs(Math.floor(cx*7+cy*13))%9):radius;
        context.beginPath();context.arc(cx,cy,r,0,Math.PI*2);context.fill();
      }
    };
    const lines=(dist,angle=0)=>{
      context.save();context.translate(x+w/2,y+h/2);context.rotate(angle);
      const len=Math.hypot(w,h)+1000;
      for(let v=-len;v<len;v+=dist){context.beginPath();context.moveTo(v,-len);context.lineTo(v,len);context.stroke();}
      context.restore();
    };
    const polygon=(px,py,r,sides,rot=0,filled=false)=>{
      context.beginPath();for(let i=0;i<sides;i++) {const a=i*2*Math.PI/sides+rot; const u=px+Math.cos(a)*r, v=py+Math.sin(a)*r;i?context.lineTo(u,v):context.moveTo(u,v);}context.closePath();filled?context.fill():context.stroke();
    };
    switch(variant) {
      case 'halftone':dots(20,20,42,4,true);break;
      case 'fine-dots':dots(11,11,19,2.3);break;
      case 'big-dots':dots(30,30,77,12);break;
      case 'grid':for(let cx=x;cx<X;cx+=58){context.beginPath();context.moveTo(cx,y);context.lineTo(cx,Y);context.stroke();}for(let cy=y;cy<Y;cy+=58){context.beginPath();context.moveTo(x,cy);context.lineTo(X,cy);context.stroke();}break;
      case 'micro-grid':for(let cx=x;cx<X;cx+=24){context.beginPath();context.moveTo(cx,y);context.lineTo(cx,Y);context.stroke();}for(let cy=y;cy<Y;cy+=24){context.beginPath();context.moveTo(x,cy);context.lineTo(X,cy);context.stroke();}break;
      case 'diagonal':lines(39,Math.PI/4);break;
      case 'crosshatch':lines(50,Math.PI/4);lines(50,-Math.PI/4);break;
      case 'vertical':lines(40);break;
      case 'horizontal':lines(40,Math.PI/2);break;
      case 'chevrons':for(let cy=y-65;cy<Y+65;cy+=50) for(let cx=x-90;cx<X+90;cx+=90){context.beginPath();context.moveTo(cx,cy);context.lineTo(cx+45,cy+25);context.lineTo(cx+90,cy);context.stroke();}break;
      case 'triangles':for(let cy=y+20;cy<Y;cy+=72) for(let cx=x+20;cx<X;cx+=75)polygon(cx+(Math.floor(cy/72)%2)*25,cy,19,3,-Math.PI/2);break;
      case 'diamonds':for(let cy=y+25;cy<Y;cy+=76) for(let cx=x+25;cx<X;cx+=76)polygon(cx,cy,23,4,0);break;
      case 'circles':for(let cy=y+26;cy<Y;cy+=75) for(let cx=x+26;cx<X;cx+=75){context.beginPath();context.arc(cx,cy,22,0,2*Math.PI);context.stroke();context.beginPath();context.arc(cx,cy,9,0,2*Math.PI);context.stroke();}break;
      case 'waves':for(let cy=y+5;cy<Y+40;cy+=44) {context.beginPath();for(let cx=x;cx<X;cx+=7){const wy=cy+13*Math.sin((cx-x)*.027);cx===x?context.moveTo(cx,wy):context.lineTo(cx,wy);}context.stroke();}break;
      case 'bricks':for(let cy=y;cy<Y;cy+=52){context.beginPath();context.moveTo(x,cy);context.lineTo(X,cy);context.stroke();for(let cx=x+(Math.floor((cy-y)/52)%2)*55;cx<X;cx+=110){context.beginPath();context.moveTo(cx,cy);context.lineTo(cx,cy+52);context.stroke();}}break;
      case 'confetti':for(let cy=y;cy<Y;cy+=32)for(let cx=x;cx<X;cx+=37){const n=Math.abs(Math.sin(cx*12.9898+cy*78.233)*43758.5453)%1;if(n>.65){context.save();context.translate(cx+n*20,cy+n*10);context.rotate(n*6);context.fillRect(-5,-2,n*14+4,4);context.restore();}}break;
      case 'stars':for(let cy=y+34;cy<Y;cy+=86)for(let cx=x+34;cx<X;cx+=86){context.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?8:21;const dx=cx+Math.cos(a)*r,dy=cy+Math.sin(a)*r;i?context.lineTo(dx,dy):context.moveTo(dx,dy);}context.closePath();context.stroke();}break;
      case 'plus':for(let cy=y+20;cy<Y;cy+=49)for(let cx=x+20;cx<X;cx+=49){context.beginPath();context.moveTo(cx-8,cy);context.lineTo(cx+8,cy);context.moveTo(cx,cy-8);context.lineTo(cx,cy+8);context.stroke();}break;
      case 'dashes':for(let cy=y+15;cy<Y;cy+=34)for(let cx=x+12;cx<X;cx+=47){context.fillRect(cx+(Math.floor(cy/34)%2)*14,cy,21,5);}break;
      case 'pixels':for(let cy=y+12;cy<Y;cy+=35)for(let cx=x+12;cx<X;cx+=35){const a=Math.abs(Math.sin(cx*19.38+cy*62.84));if(a>.45)context.fillRect(cx,cy,9+a*11,9+a*11);}break;
      case 'zigzag':for(let cy=y+25;cy<Y;cy+=50){context.beginPath();for(let cx=x;cx<X+30;cx+=25){const yy=cy+(Math.round((cx-x)/25)%2?17:-17);cx===x?context.moveTo(cx,yy):context.lineTo(cx,yy);}context.stroke();}break;
      case 'mesh':for(let cy=y+30;cy<Y;cy+=67)for(let cx=x+30;cx<X;cx+=67){polygon(cx,cy,23,6,Math.PI/6);polygon(cx+33,cy+34,23,6,Math.PI/6);}break;
      case 'rays':{const ox=x+w/2,oy=y+h/2;for(let i=0;i<48;i++){const a=i*Math.PI/24;context.beginPath();context.moveTo(ox+28*Math.cos(a),oy+28*Math.sin(a));context.lineTo(ox+Math.hypot(w,h)*Math.cos(a),oy+Math.hypot(w,h)*Math.sin(a));context.stroke();}break;}
    }
    context.restore();
  }

  function buildPatternGrid() {
    const grid=$('patternGrid');grid.textContent='';
    PATTERNS.forEach(([id,label]) => {
      const b=document.createElement('button');b.type='button';b.className='pattern-choice';b.dataset.pattern=id;b.title=label;
      const preview=document.createElement('canvas'); preview.width=100;preview.height=50;
      const text=document.createElement('span');text.textContent=label;
      b.append(preview,text);
      b.onclick=()=>{ cfgPattern.value=id;changeStyle('pattern',id); };
      grid.appendChild(b);
    });
    redrawPatternGallery();
  }
  function redrawPatternGallery() {
    $('patternGrid').querySelectorAll('button').forEach(b=>{
      b.classList.toggle('active',b.dataset.pattern===currentStyle.pattern);
      const c=b.querySelector('canvas'),g=c.getContext('2d');g.fillStyle=currentStyle.darkColor;g.fillRect(0,0,100,50);
      drawPattern(g,b.dataset.pattern,0,0,100,50);
    });
  }

  function wrapLines(context,text,maxWidth) {
    const result=[];let line='';
    for (const word of (text||'').trim().split(/\s+/)) {
      if (!word) continue;
      if (context.measureText(line?line+' '+word:word).width>maxWidth && line) {result.push(line);line=word;}
      else line=line?line+' '+word:word;
    }
    if(line)result.push(line);
    return result;
  }

  function drawWatermark() {
    if(!currentStyle.watermarkEnabled || !logoImg || !logoImg.naturalWidth) return;
    const maxSide=currentStyle.watermarkSize;
    const scale=Math.min(maxSide/logoImg.naturalWidth,maxSide/logoImg.naturalHeight);
    const w=logoImg.naturalWidth*scale,h=logoImg.naturalHeight*scale;
    const place=currentStyle.watermarkPosition;
    const right=place.endsWith('right');
    const x=right?1080-w-55:55;
    const y=place.startsWith('photo')?1385-h-35:48;
    ctx.save();ctx.globalAlpha=currentStyle.watermarkOpacity/100;
    ctx.drawImage(logoImg,x,y,w,h);ctx.restore();
  }

  function drawBackgroundImage(x,y,w,h) {
    if(!currentStyle.backgroundEnabled || !backgroundImg?.naturalWidth)return;
    const img=backgroundImg, pos=currentStyle.backgroundPosition;
    const scale=Math.max(1080/img.naturalWidth,1920/img.naturalHeight);
    const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
    const offsetX=pos==='left'?0:pos==='right'?1080-dw:(1080-dw)/2;
    const offsetY=pos==='top'?0:pos==='bottom'?1920-dh:(1920-dh)/2;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    ctx.drawImage(img,offsetX,offsetY,dw,dh);
    ctx.globalAlpha=currentStyle.backgroundTint/100;
    ctx.fillStyle=currentStyle.darkColor;ctx.fillRect(x,y,w,h);
    ctx.restore();
  }

  function renderStory(includeGuide=chkGuide.checked) {
    const W=1080,H=1920, TOP_H=720, PHOTO_Y=720,PHOTO_H=665,CTA_Y=1385,CTA_H=115,RED_Y=1500;
    const c=currentStyle;
    ctx.fillStyle=c.darkColor;ctx.fillRect(0,0,W,H);
    drawBackgroundImage(0,0,W,TOP_H);
    if(!c.backgroundEnabled) drawPattern(ctx,c.pattern,0,0,W,TOP_H,false);
    ctx.save();ctx.beginPath();ctx.rect(0,PHOTO_Y,W,PHOTO_H);ctx.clip();
    if(loadedImg && loadedImg.naturalWidth) {
      const s=Math.max(W/loadedImg.naturalWidth,PHOTO_H/loadedImg.naturalHeight)*photoState.zoom;
      const dw=loadedImg.naturalWidth*s, dh=loadedImg.naturalHeight*s;
      ctx.drawImage(loadedImg,(W-dw)/2+photoState.panX,PHOTO_Y+(PHOTO_H-dh)/2+photoState.panY,dw,dh);
    } else {
      ctx.fillStyle='#282b31';ctx.fillRect(0,PHOTO_Y,W,PHOTO_H);
      ctx.fillStyle='#9da5b0';ctx.font=cssFont('Montserrat',32);
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Seleziona una notizia',W/2,PHOTO_Y+PHOTO_H/2);
    }
    ctx.restore();
    ctx.fillStyle=c.darkColor;ctx.fillRect(0,CTA_Y,W,CTA_H);
    drawBackgroundImage(0,CTA_Y,W,CTA_H);
    if(!c.backgroundEnabled) drawPattern(ctx,c.pattern,0,CTA_Y,W,CTA_H,false);
    ctx.fillStyle=c.brandColor;ctx.fillRect(0,RED_Y,W,H-RED_Y);
    drawPattern(ctx,c.pattern,0,RED_Y,W,H-RED_Y,true);

    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=c.brandColor;
    const cta=c.ctaText || "LEGGI L'ARTICOLO SU";
    let ctaSize=60;
    ctx.font=cssFont(c.ctaFont,ctaSize,c.ctaWeight);
    while(ctaSize>29 && ctx.measureText(cta).width>975)ctx.font=cssFont(c.ctaFont,--ctaSize,c.ctaWeight);
    ctx.fillText(cta,W/2,CTA_Y+CTA_H/2+6,980);

    const title=(inpTitle.value||'Titolo della notizia').trim();
    let size=c.titleSize, lines, height;
    do {
      ctx.font=cssFont(c.titleFont,size,c.titleWeight);
      lines=wrapLines(ctx,title,930);
      height=lines.length*size*1.24;
      if(height<=TOP_H-90 || size<=34) break;
      size-=2;
    } while(true);
    ctx.textAlign='center';ctx.textBaseline='middle';
    let y=(TOP_H-height)/2+(size*1.24)/2+c.titleY;
    for(const line of lines) {
      ctx.save();ctx.lineJoin='round';ctx.lineWidth=12;ctx.strokeStyle='rgba(0,0,0,.86)';ctx.shadowColor='rgba(0,0,0,.64)';ctx.shadowBlur=14;
      ctx.font=cssFont(c.titleFont,size,c.titleWeight);ctx.strokeText(line,W/2,y,950);ctx.fillStyle='#fff';ctx.fillText(line,W/2,y,950);ctx.restore();
      y+=size*1.24;
    }
    drawWatermark();

    if(includeGuide) {
      const targetY=Math.round(.88*H);
      // Sui colori del brand molto chiari la guida diventa scura, altrimenti non si vedrebbe.
      const guide=luminance(c.brandColor)>.5?'rgba(0,0,0,.72)':'rgba(255,255,255,.88)';
      ctx.save();ctx.strokeStyle=guide;ctx.lineWidth=3;ctx.setLineDash([10,8]);
      ctx.strokeRect(W/2-290,targetY-48,580,96);ctx.setLineDash([]);
      ctx.fillStyle=guide;ctx.font=cssFont('Montserrat',25);ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('🔗 '+(c.stickerText||hostnameLabel())+' (Area Sticker 88%)',W/2,targetY,540);
      ctx.restore();
    }
  }

  // --- MI SENTO FORTUNATO ---
  // Combinazione a sorpresa ma sensata: palette collaudata, font abbinati, pattern diverso dal precedente.
  // Testi, logo, sfondo caricato e inquadratura restano quelli scelti dall'utente.
  const LUCKY_KEYS = ['brandColor','darkColor','pattern','titleFont','ctaFont','titleWeight','ctaWeight','titleSize'];
  const pick = list => list[Math.floor(Math.random()*list.length)];
  // Le ultime palette uscite (metà dell'elenco) non si ripresentano: lanci di fila danno sempre abbinamenti nuovi.
  const recentPalettes=[], luckyHistory=[];
  let luckyOwner='';
  const luckyOwnerKey = () => siteKey()+'|'+(currentArticle?String(currentArticle.id):'');
  function luckyColors() {
    const index=pick(LUCKY_PALETTES.map((_,i)=>i).filter(i=>!recentPalettes.includes(i)));
    recentPalettes.push(index);
    if(recentPalettes.length>LUCKY_PALETTES.length/2) recentPalettes.shift();
    const [,dark,brand]=LUCKY_PALETTES[index];
    // Se anche il colore del brand regge il titolo bianco, ogni tanto i due ruoli si scambiano.
    const swap=contrast(brand,'#FFFFFF')>=LUCKY_CONTRAST.title && Math.random()<.35;
    return swap?{darkColor:brand,brandColor:dark}:{darkColor:dark,brandColor:brand};
  }
  const heavyWeight = font => {
    const weights=availableWeights(font), heavy=weights.filter(w=>w>=700);
    return heavy.length?pick(heavy):weights[weights.length-1];
  };
  function luckyStyle() {
    const condensed=Math.random()<.5;
    const titleFont=pick(condensed?CONDENSED_FONTS:WIDE_FONTS);
    const ctaFont=Math.random()<.5?titleFont:pick(condensed?WIDE_FONTS:CONDENSED_FONTS);
    return {
      ...luckyColors(),
      pattern:pick(PATTERNS.map(p=>p[0]).filter(id=>id!==currentStyle.pattern)),
      titleFont, ctaFont, titleWeight:heavyWeight(titleFont), ctaWeight:heavyWeight(ctaFont),
      // I font stretti reggono un corpo più grande a parità di righe.
      titleSize:condensed?68+Math.floor(Math.random()*13):56+Math.floor(Math.random()*11)
    };
  }
  // "Indietro" vale solo per la storia (o lo stile predefinito) su cui si è lanciato.
  function syncLuckyHistory() {
    if(luckyOwner!==luckyOwnerKey()){luckyHistory.length=0;luckyOwner=luckyOwnerKey();}
    $('btnLuckyBack').disabled=!luckyHistory.length;
  }
  $('btnLucky').onclick=()=>{
    syncLuckyHistory();
    luckyHistory.push(Object.fromEntries(LUCKY_KEYS.map(k=>[k,currentStyle[k]])));
    if(luckyHistory.length>30) luckyHistory.shift();
    currentStyle=safeStyle({...currentStyle,...luckyStyle()});
    syncUI();saveCurrentStory();
  };
  $('btnLuckyBack').onclick=()=>{
    syncLuckyHistory();
    if(!luckyHistory.length) return;
    currentStyle=safeStyle({...currentStyle,...luckyHistory.pop()});
    syncUI();saveCurrentStory();
  };

  function syncUI() {
    const c=currentStyle;
    syncLuckyHistory();
    cfgColor.value=c.brandColor;cfgDarkColor.value=c.darkColor;cfgPattern.value=c.pattern;
    cfgBackgroundEnabled.checked=c.backgroundEnabled;
    cfgBackgroundTint.value=c.backgroundTint;$('lblBackgroundTint').textContent=c.backgroundTint+'%';
    cfgBackgroundPosition.value=c.backgroundPosition;
    cfgTitleFont.value=c.titleFont;cfgCtaFont.value=c.ctaFont;
    populateWeightSelect(cfgTitleWeight,c.titleFont,c.titleWeight);
    populateWeightSelect(cfgCtaWeight,c.ctaFont,c.ctaWeight);
    cfgCtaText.value=c.ctaText;cfgStickerText.value=c.stickerText;
    rngFontSize.value=c.titleSize;$('lblFontSize').textContent=c.titleSize+'px';
    rngTextY.value=c.titleY;$('lblTextY').textContent=c.titleY;
    cfgWatermarkEnabled.checked=c.watermarkEnabled;
    cfgWatermarkOpacity.value=c.watermarkOpacity;$('lblWatermarkOpacity').textContent=c.watermarkOpacity+'%';
    cfgWatermarkSize.value=c.watermarkSize;$('lblWatermarkSize').textContent=c.watermarkSize+' px';
    cfgWatermarkPosition.value=c.watermarkPosition;
    rngZoom.value=Math.round(photoState.zoom*100);$('lblZoom').textContent=rngZoom.value+'%';
    cfgMetaTarget.value=getProfile().metaTarget||'';
    redrawPatternGallery();
    renderStory();ensureFonts();
  }
  function saveCurrentStory() {
    const profile=getProfile();
    if (currentArticle) {
      profile.stories[String(currentArticle.id)]={title:inpTitle.value,style:copy(currentStyle),photoState:copy(photoState)};
    } else profile.defaults=copy(currentStyle);
    store.lastSite=siteUrl.value.trim();persistStore();
  }
  function changeStyle(key,value) {
    currentStyle[key]=value;
    currentStyle=safeStyle(currentStyle);
    syncUI();saveCurrentStory();
  }

  function loadBackground() {
    const data=getProfile().backgroundData,key=siteKey();
    backgroundImg=null;
    $('backgroundPreview').hidden=!data;
    $('backgroundPreview').src=data||'';
    $('backgroundInfo').textContent=data?'Sfondo caricato':'Nessuna immagine caricata';
    if(!data){backgroundPromise=Promise.resolve();renderStory();return;}
    backgroundPromise=new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{if(key===siteKey()){backgroundImg=img;renderStory();}resolve();};
      img.onerror=()=>resolve();
      img.src=data;
    });
  }
  $('cfgBackgroundFile').addEventListener('change',async event=>{
    const f=event.target.files?.[0];if(!f)return;
    try {
      const raw=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});
      const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=raw;});
      const scale=Math.min(1,1440/img.naturalWidth,2400/img.naturalHeight);
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      let data=c.toDataURL('image/webp',.79);
      if(!data.startsWith('data:image/webp')) data=c.toDataURL('image/jpeg',.76);
      const p=getProfile(),old=p.backgroundData;p.backgroundData=data;
      if(!persistStore()){p.backgroundData=old;return;}
      currentStyle.backgroundEnabled=true;saveCurrentStory();syncUI();loadBackground();
    }catch(err){alert('Errore sfondo: '+err.message);}
    finally{event.target.value='';}
  });
  $('btnRemoveBackground').onclick=()=>{
    const p=getProfile();p.backgroundData=null;persistStore();
    currentStyle.backgroundEnabled=false;saveCurrentStory();loadBackground();syncUI();
  };

  function loadLogo() {
    const data=getProfile().logoData, key=siteKey();
    logoImg=null;
    $('logoPreview').hidden=!data;
    $('logoPreview').src=data||'';
    $('logoInfo').textContent=data?'Logo caricato':'Nessun logo caricato';
    if(!data) { logoPromise=Promise.resolve();renderStory();return; }
    logoPromise=new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{if(key===siteKey()){logoImg=img;renderStory();}resolve();};
      img.onerror=()=>resolve();
      img.src=data;
    });
  }
  $('cfgLogoFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try {
      const raw=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
      const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=raw;});
      const max=500,scale=Math.min(1,max/img.naturalWidth,max/img.naturalHeight);
      const off=document.createElement('canvas');off.width=Math.max(1,Math.round(img.naturalWidth*scale));off.height=Math.max(1,Math.round(img.naturalHeight*scale));
      off.getContext('2d').drawImage(img,0,0,off.width,off.height);
      let data=off.toDataURL('image/webp',.88);
      if(!data.startsWith('data:image/webp'))data=off.toDataURL('image/png');
      const p=getProfile(),prev=p.logoData;p.logoData=data;
      if(!persistStore()) {p.logoData=prev;return;}
      currentStyle.watermarkEnabled=true;saveCurrentStory();syncUI();loadLogo();
    } catch(err){alert('Errore logo: '+err.message);}
    finally{e.target.value='';}
  });
  $('btnRemoveLogo').onclick=()=>{getProfile().logoData=null;persistStore();loadLogo();};

  function resetPhoto(){photoState={panX:0,panY:0,zoom:1};rngZoom.value=100;$('lblZoom').textContent='100%';renderStory();}
  function restoreCurrent() {
    const p=getProfile();if(currentArticle)delete p.stories[String(currentArticle.id)];
    currentStyle=safeStyle(p.defaults);inpTitle.value=currentArticle?.title||'';
    resetPhoto();syncUI();persistStore();renderTitleChoices();
  }
  $('btnRestoreTexts').onclick=()=>{
    inpTitle.value=currentArticle?.title||'';
    currentStyle.ctaText=getProfile().defaults.ctaText;
    currentStyle.stickerText=getProfile().defaults.stickerText;
    syncUI();saveCurrentStory();renderTitleChoices();
  };
  function saveDefaults() {
    const p=getProfile();p.defaults=safeStyle(currentStyle);p.metaTarget=cfgMetaTarget.value.trim();
    if(persistStore())alert('Stile predefinito salvato per '+hostnameLabel());
  }
  $('btnSaveDefaults').onclick=saveDefaults;$('btnSaveDefaultsVisible').onclick=saveDefaults;
  $('btnResetStory').onclick=restoreCurrent;$('btnResetStoryVisible').onclick=restoreCurrent;
  $('btnResetPhoto').onclick=()=>{resetPhoto();saveCurrentStory();};
  $('btnSettings').onclick=()=>{const el=$('boxSettings');el.style.display=el.style.display==='none'?'block':'none';};
  // Il pannello grafica parte sempre chiuso: si apre dal pulsante "Personalizza grafica".
  $('btnToggleEditor').onclick=()=>{
    const panel=$('advancedEditor'), open=panel.hidden;
    panel.hidden=!open;
    $('btnToggleEditor').setAttribute('aria-expanded',String(open));
    $('btnToggleEditor').classList.toggle('expanded',open);
    $('editorToggleLabel').textContent=open?'Chiudi':'Apri';
  };

  $('cfgMetaTarget').addEventListener('input',()=>{getProfile().metaTarget=cfgMetaTarget.value.trim();persistStore();});
  inpTitle.addEventListener('input',()=>{
    renderStory();saveCurrentStory();
    $('titleChoices').querySelectorAll('.title-choice').forEach(b=>b.classList.toggle('active',b.lastChild.textContent.trim()===inpTitle.value.trim()));
  });
  [[cfgColor,'brandColor'],[cfgDarkColor,'darkColor'],[cfgPattern,'pattern'],
   [cfgTitleFont,'titleFont'],[cfgCtaFont,'ctaFont'],
   [cfgTitleWeight,'titleWeight'],[cfgCtaWeight,'ctaWeight'],[cfgCtaText,'ctaText'],[cfgStickerText,'stickerText'],
   [cfgBackgroundTint,'backgroundTint'],[cfgBackgroundPosition,'backgroundPosition'],
   [cfgWatermarkOpacity,'watermarkOpacity'],[cfgWatermarkSize,'watermarkSize'],
   [cfgWatermarkPosition,'watermarkPosition']].forEach(([el,key])=>el.addEventListener('input',()=>changeStyle(key,el.value)));
  cfgBackgroundEnabled.addEventListener('change',()=>changeStyle('backgroundEnabled',cfgBackgroundEnabled.checked));
  cfgWatermarkEnabled.addEventListener('change',()=>changeStyle('watermarkEnabled',cfgWatermarkEnabled.checked));
  rngFontSize.addEventListener('input',()=>changeStyle('titleSize',rngFontSize.value));
  rngTextY.addEventListener('input',()=>changeStyle('titleY',rngTextY.value));
  rngZoom.addEventListener('input',()=>{photoState.zoom=Number(rngZoom.value)/100;$('lblZoom').textContent=rngZoom.value+'%';renderStory();saveCurrentStory();});
  chkGuide.addEventListener('change',()=>renderStory());

  // --- CONTROLLI MOUSE + TOUCH E PINCH-TO-ZOOM ---
  const wrap=$('canvasWrap');
  let pinchStartDist=0, pinchStartZoom=1;

  wrap.addEventListener('mousedown',e=>{if(e.button!==0)return;isDragging=true;dragStart={x:e.clientX,y:e.clientY,panX:photoState.panX,panY:photoState.panY};});
  window.addEventListener('mousemove',e=>{
    if(!isDragging||!dragStart)return;
    const scale=1080/Math.max(1,canvas.getBoundingClientRect().width);
    photoState.panX=dragStart.panX+(e.clientX-dragStart.x)*scale;
    photoState.panY=dragStart.panY+(e.clientY-dragStart.y)*scale;renderStory();
  });
  window.addEventListener('mouseup',()=>{if(isDragging){isDragging=false;saveCurrentStory();}});
  wrap.addEventListener('wheel',e=>{
    e.preventDefault();const z=clamp(Number(rngZoom.value)+(e.deltaY<0?8:-8),50,250);
    photoState.zoom=z/100;rngZoom.value=z;$('lblZoom').textContent=z+'%';renderStory();saveCurrentStory();
  },{passive:false});

  wrap.addEventListener('touchstart',e=>{
    if(e.touches.length===1){
      isDragging=true;
      const t=e.touches[0];
      dragStart={x:t.clientX,y:t.clientY,panX:photoState.panX,panY:photoState.panY};
    } else if(e.touches.length===2){
      isDragging=false;
      pinchStartDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      pinchStartZoom=photoState.zoom;
    }
  },{passive:true});

  wrap.addEventListener('touchmove',e=>{
    e.preventDefault();
    if(e.touches.length===1 && isDragging && dragStart){
      const t=e.touches[0];
      const scale=1080/Math.max(1,canvas.getBoundingClientRect().width);
      photoState.panX=dragStart.panX+(t.clientX-dragStart.x)*scale;
      photoState.panY=dragStart.panY+(t.clientY-dragStart.y)*scale;
      renderStory();
    } else if(e.touches.length===2 && pinchStartDist>0){
      const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      const z=clamp(Math.round(pinchStartZoom*(dist/pinchStartDist)*100),50,250);
      photoState.zoom=z/100;rngZoom.value=z;$('lblZoom').textContent=z+'%';
      renderStory();
    }
  },{passive:false});

  wrap.addEventListener('touchend',()=>{isDragging=false;pinchStartDist=0;saveCurrentStory();});

  function selectArticle(it,cardEl,autoSwitchTab=false,{withAiTitles=true}={}) {
    articleToken++;const token=articleToken;
    document.querySelectorAll('.news-card').forEach(c=>c.classList.remove('active'));
    cardEl?.classList.add('active');currentArticle=it;
    const override=getProfile().stories[String(it.id)];
    currentStyle=safeStyle(override?.style||getProfile().defaults);
    inpTitle.value=override && typeof override.title==='string'?override.title:it.title;
    const ps=override?.photoState;
    photoState=ps?{panX:Number(ps.panX)||0,panY:Number(ps.panY)||0,zoom:clamp(Number(ps.zoom)||1,.5,2.5)}:{panX:0,panY:0,zoom:1};
    loadedImg=null;syncUI();
    if(withAiTitles)scheduleAiTitles();else renderTitleChoices();
    if(it.image) {
      photoPromise=new Promise(resolve=>{
        const img=new Image();img.crossOrigin='anonymous';
        img.onload=()=>{if(token===articleToken){loadedImg=img;renderStory();}resolve();};
        img.onerror=()=>resolve();
        img.src=`proxy.php?action=img&url=${encodeURIComponent(it.image)}`;
      });
    } else photoPromise=Promise.resolve();
    if(autoSwitchTab && window.innerWidth<=850) switchMobileTab('studio');
  }

  async function fetchNews() {
    const site=siteUrl.value.trim(),listEl=$('newsList');
    if(!/^https?:\/\//i.test(site))return alert('Inserisci un indirizzo valido con https://');
    listEl.textContent='Caricamento articoli in corso…';
    try {
      const r=await fetch(`proxy.php?action=feed&site=${encodeURIComponent(site)}&n=20`);
      const data=await r.json();
      if(!r.ok || !Array.isArray(data.items))throw Error(data.error||'Risposta feed non valida');
      listEl.textContent='';$('newsCount').textContent=data.items.length+' articoli';$('statNews').textContent=data.items.length;
      const sourceHint=$('feedSource');if(sourceHint)sourceHint.textContent='Fonte: '+(data.source==='rss'?'Feed RSS / Atom':'WordPress REST API');
      data.items.forEach((it,idx)=>{
        const card=document.createElement('div');card.className='news-card';card.dataset.articleId=String(it.id);
        const image=document.createElement('img');image.alt='';
        if(it.image)image.src=`proxy.php?action=img&url=${encodeURIComponent(it.image)}`;
        const column=document.createElement('div'),h=document.createElement('h4'),sub=document.createElement('div');
        h.textContent=it.title;sub.textContent='#'+it.id;sub.className='news-meta';column.append(h,sub);
        // Aggiunta rapida: stessa grafica predefinita (o già personalizzata) senza aprire l'editor.
        const quick=document.createElement('button');quick.type='button';quick.className='quick-queue';
        quick.title='Aggiungi subito alla coda di pubblicazione';
        quick.onclick=event=>{event.stopPropagation();quickAdd(it,card,quick);};
        card.append(image,column,quick);
        card.onclick=()=>selectArticle(it,card,true);listEl.appendChild(card);
        if(idx===0)selectArticle(it,card,false);
      });
      refreshQuickButtons();
    } catch(err){listEl.textContent='Errore lettura feed: '+err.message;}
  }
  $('btnFetch').onclick=fetchNews;
  siteUrl.addEventListener('change',()=>{
    if(siteKey()===normalizeSite(store.lastSite))return;
    store.lastSite=siteUrl.value.trim();persistStore();
    currentArticle=null;articleToken++;loadedImg=null;photoPromise=Promise.resolve();
    $('newsList').textContent='Premi “Carica notizie” per il nuovo sito.';
    currentStyle=safeStyle(getProfile().defaults);inpTitle.value='';resetPhoto();syncUI();loadLogo();loadBackground();renderTitleChoices();
  });

  // --- TITOLI ALTERNATIVI CON AI (3 proposte + titolo originale del sito) ---
  // Compaiono da soli sotto il titolo quando si seleziona una notizia; senza chiave la sezione resta
  // sfocata con l'invito a sbloccarla. Se un modello Gemini è al limite d'uso o sovraccarico si passa
  // al successivo: i limiti gratuiti di Google valgono per singolo modello.
  // Il fornitore è isolato in requestAiTitles(): per passare a un altro servizio basta cambiare quella funzione.
  const GEMINI_API='https://generativelanguage.googleapis.com/v1beta/models';
  // Ordine scelto misurando i tempi reali (ottobre 2026): 3.5 Flash risponde in pochi secondi,
  // l'alias gemini-flash-latest può impiegarne più di 20. I modelli ritirati rispondono 404 e vengono saltati.
  const AI_MODELS=['gemini-3.5-flash','gemini-flash-lite-latest','gemini-3.5-flash-lite','gemini-flash-latest'];
  const AI_TIMEOUT_MS=Number(window.__SF_AI_TIMEOUT_MS)||20000;
  const AI_TOTAL_MS=Number(window.__SF_AI_TOTAL_MS)||45000;
  const AI_MAX_ATTEMPTS=6;
  const AI_CACHE_KEY='storyflow.studio.aititles.v4';
  const AI_KEY_URL='https://aistudio.google.com/apikey';
  const aiState=new Map();
  let aiSettings={key:'',model:''}, aiCache={}, listedModels=null, aiTimer=null;
  try {
    const saved=JSON.parse(localStorage.getItem(AI_STORE_KEY)||'{}');
    aiSettings={key:String(saved.key||''),model:String(saved.model||'')};
  } catch(_) {}
  try { const c=JSON.parse(localStorage.getItem(AI_CACHE_KEY)||'{}'); if(c && typeof c==='object')aiCache=c; } catch(_) {}
  cfgGeminiKey.value=aiSettings.key;cfgAiModel.value=aiSettings.model;
  const saveAiSettings=()=>{
    const keyChanged=aiSettings.key!==cfgGeminiKey.value.trim();
    aiSettings={key:cfgGeminiKey.value.trim(),model:cfgAiModel.value.trim()};
    try{localStorage.setItem(AI_STORE_KEY,JSON.stringify(aiSettings));}catch(_){}
    if(keyChanged){listedModels=null;aiState.clear();}
    scheduleAiTitles();
  };
  cfgGeminiKey.addEventListener('change',saveAiSettings);cfgAiModel.addEventListener('change',saveAiSettings);

  const articleKey=a=>String(a?.url||a?.id||'');
  function rememberTitles(key,titles) {
    aiCache[key]={t:titles,at:Date.now()};
    const keys=Object.keys(aiCache);
    if(keys.length>150) keys.sort((a,b)=>aiCache[a].at-aiCache[b].at).slice(0,keys.length-150).forEach(k=>delete aiCache[k]);
    try{localStorage.setItem(AI_CACHE_KEY,JSON.stringify(aiCache));}catch(_){}
  }

  // Tre titoli in scala di curiosità: leggero → medio → forte, ognuno con una tecnica diversa.
  const AI_LEVELS=[['leggero','● Leggero'],['medio','●● Medio'],['forte','●●● Forte']];
  // La curiosità nasce togliendo informazioni presenti nel titolo originale, mai aggiungendone di nuove.
  const titlePrompt=original=>[
    'Sei il social media editor di una testata giornalistica online. Scrivi 3 titoli alternativi per una storia Instagram/Facebook che rimanda all\'articolo con un adesivo link.',
    '',
    'COME CREARE CURIOSITÀ (curiosity gap): non aggiungere niente, togli. Prendi un\'informazione che è già nel titolo originale (chi, cosa, dove, quando, quanto, l\'esito) e tienila nascosta, lasciando capire che la risposta è nell\'articolo.',
    'Scala di intensità:',
    '- leggero: restano tutte le informazioni principali; la notizia è solo raccontata in modo più vivace e diretto.',
    '- medio: rendi generico un elemento che il lettore vuole davvero sapere (il protagonista diventa per esempio "una delle stelle", la decisione diventa "la scelta"), così capisce l\'argomento ma non tutto.',
    '- forte: nascondi l\'informazione più importante del titolo originale (il fatto o il protagonista); resta solo il contesto che serve a capire l\'argomento.',
    'Nascondi sempre un elemento interessante, mai un dettaglio banale: chiedersi il mese o il numero di anni non incuriosisce nessuno.',
    '',
    'VARIETÀ: ogni titolo ha una struttura e un attacco diversi (affermazione, frase con i due punti, domanda…). Al massimo uno dei tre può essere una domanda. Non devono essere tre varianti della stessa frase.',
    '',
    'REGOLE GIORNALISTICHE (obbligatorie):',
    '- Usa solo ciò che è scritto nel titolo originale. Vietato aggiungere fatti, nomi, numeri, date, luoghi, cause, motivi, retroscena, reazioni o citazioni.',
    '- Non cambiare il significato: ciò che è certo resta certo (se "salta" lo show, non scrivere "è a rischio") e i termini del settore restano quelli (un wrestler non diventa un "giocatore").',
    '- Vietati aggettivi e giudizi che il titolo originale non contiene, come "a sorpresa", "inattesa", "clamorosa", "storica", "straordinaria", "dell\'ultimo minuto", "che sorprende tutti".',
    '- Non promettere contenuti che il titolo originale non garantisce: niente "ecco perché", "il motivo", "i dettagli", "spiega", "svela" se l\'originale non li annuncia.',
    '- Vietate le formule acchiappaclic logore: "non crederai", "incredibile", "shock", "pazzesco", "ecco cosa è successo", "lascia tutti senza parole".',
    '- Stessa lingua del titolo originale, con espressioni naturali e idiomatiche, mai calchi dall\'inglese.',
    '- Brevi e incisivi: idealmente 50-90 caratteri, mai oltre 110. Niente hashtag, emoji, virgolette all\'inizio o alla fine, né maiuscolo per enfasi.',
    '',
    'ESEMPIO (solo per capire il metodo, non riusarne le parole)',
    'Titolo originale: Il club ufficializza l\'acquisto del nuovo attaccante brasiliano',
    '- leggero: Il club ha il suo nuovo attaccante: ufficiale l\'arrivo dal Brasile',
    '- medio: Ufficiale il nuovo attaccante del club: ecco da dove arriva',
    '- forte: Il club ha chiuso l\'operazione: chi è il nuovo arrivo?',
    'Sbagliato: "Il club piazza il colpo a sorpresa dal Brasile" (aggiunge "a sorpresa"); "Ecco perché il club ha scelto il brasiliano" (promette un motivo che il titolo non cita).',
    '',
    'Titolo originale: '+original
  ].join('\n');

  // fetch con tempo massimo: una richiesta bloccata non lascia più il pannello in caricamento infinito.
  async function fetchJson(url,options,ms) {
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),ms);
    try {
      const r=await fetch(url,{...options,signal:ctrl.signal});
      return {status:r.status,ok:r.ok,json:await r.json().catch(()=>({}))};
    } catch(e) {
      return {status:0,ok:false,json:{error:{message:e.name==='AbortError'?'nessuna risposta entro il tempo massimo':e.message}}};
    } finally { clearTimeout(timer); }
  }

  // Modelli "flash" che Google abilita per questa chiave: riserva dopo quelli predefiniti, prima i "lite".
  async function listFlashModels(key) {
    if(listedModels)return listedModels;
    const r=await fetchJson(`${GEMINI_API}?pageSize=200`,{headers:{'x-goog-api-key':key}},10000);
    listedModels=(r.ok&&Array.isArray(r.json.models)?r.json.models:[])
      .filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent'))
      .map(m=>String(m.name||'').replace(/^models\//,''))
      .filter(n=>/flash/.test(n) && !/image|tts|audio|live|embedding|exp|thinking/.test(n))
      .sort((a,b)=>Number(/lite/.test(b))-Number(/lite/.test(a)));
    return listedModels;
  }

  function parseTitles(json,original) {
    const raw=(json.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('').trim();
    let list;
    try {
      const data=JSON.parse(raw);
      list=Array.isArray(data.titles)?data.titles:AI_LEVELS.map(([k])=>data[k]).filter(Boolean);
    } catch(_) { list=raw.split('\n'); }
    return [...new Set((Array.isArray(list)?list:[]).map(t=>String(t).replace(/^\s*(?:\d+[.)]\s+|[-•*]\s+)/,'').replace(/^[\s"“”«»']+|[\s"“”«»']+$/g,'').trim()))]
      .filter(t=>t && t.toLowerCase()!==original.trim().toLowerCase()).map(t=>t.slice(0,140)).slice(0,3);
  }

  const describeAiError=(status,message)=>({
    0:'nessuna risposta',429:'limite d’uso raggiunto',404:'non disponibile',500:'errore del servizio',503:'sovraccarico',504:'nessuna risposta'
  })[status]||(`errore HTTP ${status}`+(message?`: ${message}`:''));

  async function requestAiTitles(original) {
    const key=aiSettings.key;
    if(!key) throw Error('Chiave API Gemini mancante');
    const started=Date.now(), tried=new Set(), errors=[];
    const queue=[...new Set([aiSettings.model,...AI_MODELS].filter(Boolean))];
    let listedAdded=false;
    while(tried.size<AI_MAX_ATTEMPTS && Date.now()-started<AI_TOTAL_MS) {
      if(!queue.length) {
        if(listedAdded)break;
        listedAdded=true;
        queue.push(...(await listFlashModels(key)).filter(m=>!tried.has(m)));
        if(!queue.length)break;
      }
      const model=queue.shift();
      if(tried.has(model))continue;
      tried.add(model);
      const call=withThinking=>fetchJson(`${GEMINI_API}/${encodeURIComponent(model)}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
        body:JSON.stringify({
          contents:[{parts:[{text:titlePrompt(original)}]}],
          generationConfig:{temperature:0.9,responseMimeType:'application/json',
            responseSchema:{type:'OBJECT',properties:Object.fromEntries(AI_LEVELS.map(([k])=>[k,{type:'STRING'}])),
              required:AI_LEVELS.map(([k])=>k),propertyOrdering:AI_LEVELS.map(([k])=>k)},
            // Ragionamento interno ridotto: con quello predefinito i modelli recenti impiegano decine di secondi.
            ...(withThinking?{thinkingConfig:{thinkingLevel:'low'}}:{})}
        })
      },AI_TIMEOUT_MS);
      let r=await call(true);
      if(r.status===400 && !/api.?key/i.test(String(r.json.error?.message||'')))r=await call(false);
      const message=String(r.json.error?.message||'');
      if(r.status===401 || r.status===403 || (r.status===400 && /api.?key/i.test(message)))
        throw Error('La chiave API non è valida o non ha i permessi: controllala in “Impostazioni sito”.');
      if(r.ok) {
        const titles=parseTitles(r.json,original);
        if(titles.length)return titles;
        errors.push({model,status:200,text:'risposta senza titoli'});
      } else errors.push({model,status:r.status,text:describeAiError(r.status,message)});
    }
    if(errors.length && errors.every(e=>e.status===429))
      throw Error('Hai raggiunto il limite d’uso gratuito di Gemini su tutti i modelli disponibili. Riprova più tardi: il limite si azzera da solo.');
    throw Error('Gemini non ha risposto. '+(errors.map(e=>`${e.model}: ${e.text}`).join(' · ')||'Nessun modello disponibile per questa chiave.'));
  }

  function scheduleAiTitles() {
    clearTimeout(aiTimer);
    renderTitleChoices();
    const article=currentArticle;
    if(!article||!aiSettings.key||aiCache[articleKey(article)])return;
    // Dopo un errore non si riprova da soli per un minuto (resta il pulsante "Riprova").
    const st=aiState.get(articleKey(article));
    if(st?.status==='error' && Date.now()-st.at<60000)return;
    // Breve attesa: scorrendo velocemente le notizie non parte una richiesta per ognuna.
    aiTimer=setTimeout(()=>{ if(currentArticle===article)void generateTitlesFor(article); },400);
  }

  async function generateTitlesFor(article,force=false) {
    const key=articleKey(article);
    if(!aiSettings.key || aiState.get(key)?.status==='loading')return;
    if(aiCache[key] && !force){renderTitleChoices();return;}
    aiState.set(key,{status:'loading'});
    if(currentArticle===article)renderTitleChoices();
    try {
      rememberTitles(key,await requestAiTitles(article.title));
      aiState.delete(key);
    } catch(err) { aiState.set(key,{status:'error',error:err.message,at:Date.now()}); }
    if(currentArticle===article)renderTitleChoices();
  }

  function el(tag,className,text) {
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  }

  function choiceButton(tagText,text,current) {
    const choice=el('button','title-choice');choice.type='button';
    choice.classList.toggle('active',text.trim()===current);
    choice.append(el('span','title-choice-tag',tagText),el('span','',text));
    choice.onclick=()=>{inpTitle.value=text;renderStory();saveCurrentStory();renderTitleChoices();};
    return choice;
  }

  function renderTitleChoices() {
    const box=$('titleChoices');box.textContent='';
    if(!currentArticle){box.hidden=true;return;}
    box.hidden=false;
    const key=articleKey(currentArticle), cached=aiCache[key]?.t, st=aiState.get(key), current=inpTitle.value.trim();

    const head=el('div','title-choices-head');
    head.append(el('span','',aiSettings.key?'✨ Titoli alternativi':'✨ Titoli alternativi con AI'));
    if(aiSettings.key && st?.status!=='loading' && (cached||st?.status==='error')) {
      const again=el('button','title-regen',cached?'↻ Altri 3':'↻ Riprova');again.type='button';
      again.onclick=()=>generateTitlesFor(currentArticle,true);
      head.append(again);
    }
    box.append(head,choiceButton('Dal sito',currentArticle.title,current));

    if(!aiSettings.key) {
      const locked=el('div','title-locked');
      ['Un titolo che incuriosisce e fa toccare il link','La stessa notizia raccontata con più impatto','Una domanda che invoglia a leggere l’articolo']
        .forEach((t,i)=>{ const row=el('div','title-choice title-fake');row.append(el('span','title-choice-tag',AI_LEVELS[i][1]),el('span','',t));locked.append(row); });
      const overlay=el('div','title-lock-overlay'), card=el('div','title-lock-card');
      card.append(el('strong','','🔒 Aggiungi le API Google gratis in 30 secondi per sbloccare questa sezione'));
      const steps=el('div','title-lock-steps');
      const link=el('a','title-lock-link','1. Crea la chiave gratis ↗');link.href=AI_KEY_URL;link.target='_blank';link.rel='noopener';
      const input=el('input');input.type='password';input.placeholder='2. Incolla qui la chiave';input.autocomplete='off';
      const unlock=el('button','primary','Sblocca');unlock.type='button';
      unlock.onclick=()=>{
        if(!input.value.trim()){input.focus();return;}
        cfgGeminiKey.value=input.value.trim();saveAiSettings();
      };
      input.addEventListener('keydown',e=>{if(e.key==='Enter')unlock.click();});
      steps.append(link,input,unlock);
      card.append(steps);overlay.append(card);
      locked.append(overlay);
      box.append(locked);
      return;
    }
    if(cached) { cached.forEach((t,i)=>box.append(choiceButton(AI_LEVELS[i]?.[1]||'AI '+(i+1),t,current))); return; }
    if(st?.status==='error') { box.append(el('div','title-error',st.error)); return; }
    for(let i=0;i<3;i++){ const row=el('div','title-choice title-skeleton');row.append(el('span','title-choice-tag',AI_LEVELS[i][1]),el('span','',i===0?'Genero titoli alternativi…':''));box.append(row); }
  }

  async function exportStoryDataUrl() {
    await photoPromise;await logoPromise;await backgroundPromise;await ensureFonts();
    renderStory(false);
    let url;
    try {url=canvas.toDataURL('image/jpeg',.92);}
    finally{renderStory(chkGuide.checked);}
    return url;
  }
  $('btnDownload').onclick=async()=>{
    try {
      const data=await exportStoryDataUrl(),a=document.createElement('a');
      a.href=data;a.download=`story-${currentArticle?.id||Date.now()}.jpg`;a.click();
    } catch(e) {alert('Impossibile esportare: '+e.message);}
  };

  function updateQueueUI() {
    $('queueCount').textContent=queue.length;
    $('statQueue').textContent=queue.length;
    const mobBadge=$('mobQueueBadge'); if(mobBadge) mobBadge.textContent=queue.length;
    refreshQuickButtons();
    const el=$('queueList');el.textContent='';
    if(!queue.length){const p=document.createElement('p');p.className='small-note';p.textContent='Modifica una o più storie e clicca su “Aggiungi in Coda”.';el.appendChild(p);return;}
    queue.forEach((item,idx)=>{
      const row=document.createElement('div');row.className='queue-item';
      const img=document.createElement('img');img.src=item.dataUrl;img.alt='Anteprima';
      const label=document.createElement('div');label.className='q-title';label.textContent=item.title;
      const remove=document.createElement('button');remove.type='button';remove.textContent='✕';
      remove.onclick=()=>{queue.splice(idx,1);updateQueueUI();};row.append(img,label,remove);el.appendChild(row);
    });
  }
  const isQueued=id=>queue.some(item=>String(item.id)===String(id));
  function refreshQuickButtons() {
    document.querySelectorAll('.news-card').forEach(card=>{
      const b=card.querySelector('.quick-queue');if(!b||b.dataset.busy)return;
      const queued=isQueued(card.dataset.articleId);
      card.classList.toggle('queued',queued);
      b.textContent=queued?'✓ In coda':'＋ Coda';
      b.disabled=queued;
    });
  }
  // Prepara la storia dell'articolo selezionato; se è già in coda la sostituisce con la versione aggiornata.
  async function addCurrentToQueue() {
    const article=currentArticle;
    const jpg=await exportStoryDataUrl();
    const item={id:article.id,title:inpTitle.value.trim()||article.title,url:article.url,dataUrl:jpg,
      stickerText:currentStyle.stickerText.trim()||hostnameLabel(),metaTarget:cfgMetaTarget.value.trim()};
    const existing=queue.findIndex(q=>String(q.id)===String(article.id));
    if(existing>=0)queue[existing]=item;else queue.push(item);
    updateQueueUI();
    return existing>=0;
  }
  // Le aggiunte rapide vanno in fila: ognuna usa l'anteprima condivisa, quindi non possono sovrapporsi.
  let quickChain=Promise.resolve();
  function quickAdd(article,card,button) {
    if(isQueued(article.id)||button.dataset.busy)return;
    button.dataset.busy='1';button.disabled=true;button.textContent='⏳';
    quickChain=quickChain.then(async()=>{
      try {
        selectArticle(article,card,false,{withAiTitles:false});
        await addCurrentToQueue();
      } catch(e){alert('Errore preparazione storia: '+e.message);}
      finally{delete button.dataset.busy;refreshQuickButtons();}
    });
  }
  $('btnAddQueue').onclick=async()=>{
    if(!currentArticle)return alert('Seleziona prima una notizia!');
    const b=$('btnAddQueue');b.disabled=true;b.textContent='⏳ Elaborazione...';
    let replaced=false;
    try { replaced=await addCurrentToQueue(); }
    catch(e){alert('Errore preparazione storia: '+e.message);}
    finally{
      b.disabled=false;b.textContent=replaced?'✓ Storia in coda aggiornata':'➕ Aggiungi Storia in Coda';
      if(replaced)setTimeout(()=>{b.textContent='➕ Aggiungi Storia in Coda';},2000);
    }
  };
  $('btnClearQueue').onclick=()=>{queue=[];updateQueueUI();};

  // --- MOTORE DI PUBBLICAZIONE (APP NATIVA MOBILE + ESTENSIONE CHROME) ---
  const progressModal=$('publishModal');
  const STAGES=['start','image','link','sticker','verify','publish'];
  const STEP_PCT={start:8,image:25,link:48,sticker:62,verify:78,publish:92,done:100,error:92};
  const STEP_TEXT={start:'Preparazione della storia',image:'Elaborazione della grafica',link:'Preparazione dei collegamenti',sticker:'Creazione adesivo cliccabile',verify:'Controllo dei collegamenti',publish:'Finalizzazione',done:'Operazione conclusa',error:'Operazione non completata'};
  const STEP_GROUP={start:'start',image:'image',link:'link',sticker:'link',verify:'link',publish:'publish'};
  const GROUPS=['start','image','link','publish'];

  let workflowActive=false, activeRequestId=null, extensionConnected=false, lastHeartbeat=0;
  let lastActiveStage='start', reportCache='', lastProgressPct=0, currentDryRun=false;

  function setExtensionState(connected, label='') {
    extensionConnected=Boolean(connected) || isNativeApp();
    const canStart=extensionConnected && !workflowActive;
    ['btnPublishQueue','btnTestQueue'].forEach(id=>{ $(id).disabled=!canStart; });
    $('extensionGate').hidden=extensionConnected;
    const status=$('extStatus');
    status.classList.toggle('online',extensionConnected);
    const appLabel=nativePlatform()==='desktop'?'App desktop · Pronta':'App Android · Pronta';
    status.textContent=isNativeApp()?appLabel:(extensionConnected?'Motore collegato':(label||'Motore da collegare'));
    if(!workflowActive)$('statStatus').textContent=extensionConnected?'Pronto':'In attesa';
    if(isNativeApp()){
      $('btnMetaLogin').hidden=false;
      $('btnRevealWork').hidden=false;
      $('btnExtension').hidden=true;
      showEngineVersion();
    }
  }
  function showEngineVersion() {
    try {
      if(typeof window.StoryFlowNative.getEngineInfo!=='function')return;
      const info=JSON.parse(window.StoryFlowNative.getEngineInfo()||'{}');
      if(info.version)$('versionTag').textContent=`VERSIONE 4.0 · MOTORE ${info.version}`;
    } catch(_) {}
  }

  $('btnMetaLogin').onclick=()=>{
    if(isNativeApp()) window.StoryFlowNative.openMetaLogin();
  };
  $('btnRevealWork').onclick=()=>{
    if(isNativeApp()) window.StoryFlowNative.openMetaLogin();
    else window.postMessage({source:'STORYFLOW_SAAS',cmd:'REVEAL_WORK_TAB'},location.origin);
  };

  function showOutcomeBanner(isSuccess, title, desc) {
    const box = $('publishOutcome');
    box.hidden = false;
    box.className = 'publish-outcome ' + (isSuccess ? 'success' : 'error');
    $('publishOutcomeTitle').textContent = (isSuccess ? '✓ ' : '✕ ') + title;
    $('publishOutcomeDesc').textContent = desc;
  }

  function updateProgress(info){
    const stage=STAGES.includes(info.stage)?info.stage:(info.stage==='done'||info.stage==='error'?info.stage:'start');
    const terminal=stage==='done'||stage==='error';
    if(STAGES.includes(stage))lastActiveStage=stage;
    const failedStage=STAGES.includes(info.failedStage)?info.failedStage:lastActiveStage;
    const visualStage=stage==='error'?failedStage:stage;
    const count=Number(info.index)||1,total=Math.max(1,Number(info.total)||queue.length||1);
    const local=stage==='error'?(STEP_PCT[failedStage]||8):STEP_PCT[stage];
    const calculated=Math.min(100,Math.round(((count-1)+(local/100))/total*100));
    const pct=terminal&&stage==='done'?100:Math.min(99,Math.max(lastProgressPct,calculated));
    lastProgressPct=pct;
    $('progressFill').style.width=pct+'%';
    $('progressFill').classList.toggle('completed',stage==='done');
    $('progressFill').classList.toggle('failed',stage==='error');
    $('progressPct').textContent=stage==='error'?'Da verificare':pct+'%';
    $('progressCount').textContent=`Storia ${Math.min(count,total)} di ${total}`;
    $('publishTitle').textContent=stage==='error'?'Problema rilevato':stage==='done'?(info.dryRun?'Test completato':'Storie pubblicate!'):'Pubblicazione in corso';
    $('progressLast').textContent=info.message || (STEP_TEXT[stage]+'…');

    const activeGroup=STEP_GROUP[visualStage]||'start';
    const groupIdx=GROUPS.indexOf(activeGroup);
    document.querySelectorAll('#progressSteps li').forEach(li=>{
      const pos=GROUPS.indexOf(li.dataset.stage);
      li.classList.toggle('completed',stage==='done'||(groupIdx>=0&&pos<groupIdx));
      li.classList.toggle('active',!terminal&&li.dataset.stage===activeGroup);
      li.classList.toggle('failed',stage==='error'&&li.dataset.stage===activeGroup);
    });

    if(stage==='error'){
      const explanation=String(info.errorReason||info.message||'Errore durante la lavorazione.');
      $('publishDiagnosis').hidden=false;
      $('publishFailureStage').textContent='Fase: '+(STEP_TEXT[failedStage]||failedStage);
      $('publishFailureMessage').textContent=explanation;
      $('publishTechnicalLog').textContent=Array.isArray(info.log)&&info.log.length?info.log.join('\n'):'';
      reportCache=`StoryFlow — Errore\nFase: ${failedStage}\nMotivo: ${explanation}\n`+(info.log||[]).join('\n');
      showOutcomeBanner(false, 'Esito negativo', explanation);
    }
    if(stage==='done'){
      $('publishDiagnosis').hidden=true;
      showOutcomeBanner(true, info.dryRun ? 'Test riuscito!' : 'Esito positivo!', info.message || 'Operazione completata.');
      if (!info.dryRun) { queue = []; updateQueueUI(); }
    }
    if(terminal){
      workflowActive=false; activeRequestId=null;
      setExtensionState(extensionConnected);
    }
  }

  // Ricezione avanzamento diretto dall'App Mobile Nativa
  window.__onStoryFlowNativeProgress = function(progressObj) {
    progressModal.hidden = false;
    updateProgress(progressObj);
  };

  function startQueue(dryRun){
    if(!queue.length)return alert('La coda è vuota. Aggiungi almeno una storia.');
    // Il nome dei canali serve a verificare di pubblicare sull'account giusto.
    const target=cfgMetaTarget.value.trim();
    queue.forEach(it=>{ if(!it.metaTarget)it.metaTarget=target; });
    if(queue.some(it=>!it.metaTarget)){
      $('boxSettings').style.display='block';cfgMetaTarget.focus();
      return alert('Scrivi in “Impostazioni sito” il nome della Pagina/profilo su cui pubblicare, così StoryFlow controlla di usare l’account giusto.');
    }
    if(workflowActive)return alert('Una richiesta è già in corso.');

    activeRequestId='sf-'+Date.now();
    lastProgressPct=0;workflowActive=true;lastActiveStage='start';currentDryRun=!!dryRun;
    setExtensionState(true);
    progressModal.hidden=false;
    $('publishDiagnosis').hidden=true;
    $('publishOutcome').hidden=true;
    $('progressFill').style.width='5%';
    $('progressLast').textContent='Avvio del browser desktop integrato…';

    if(isNativeApp()){
      window.StoryFlowNative.startQueue(JSON.stringify({
        reqId: activeRequestId,
        dryRun: !!dryRun,
        items: queue
      }));
      return;
    }

    window.postMessage({source:'STORYFLOW_SAAS',cmd:'START_PUBLISH_QUEUE',reqId:activeRequestId,dryRun,items:queue},location.origin);
  }

  $('btnPublishQueue').onclick=()=>startQueue(false);
  $('btnTestQueue').onclick=()=>startQueue(true);
  $('btnOutcomeDone').onclick=()=>{progressModal.hidden=true;};
  $('btnCloseProgress').onclick=()=>{progressModal.hidden=true;};
  $('btnCopyError').onclick=async()=>{
    if(!reportCache)return;
    try {await navigator.clipboard.writeText(reportCache);$('btnCopyError').textContent='Copiato';} catch(_){}
  };
  $('btnLastReport').onclick=()=>{
    progressModal.hidden=false;$('publishOutcome').hidden=true;
    if(isNativeApp()){
      const raw = window.StoryFlowNative.getLastReport();
      try {
        const msg = JSON.parse(raw);
        if(!msg.available){$('progressLast').textContent='Nessuna esecuzione memorizzata.';return;}
        if(msg.summary?.err>0) updateProgress({stage:'error',failedStage:msg.lastError?.stage||'start',message:msg.lastError?.message,log:msg.log});
        else $('progressLast').textContent=`Ultima esecuzione OK: ${msg.summary?.ok||0} pubblicate, 0 errori.`;
      } catch(_){}
      return;
    }
    window.postMessage({source:'STORYFLOW_SAAS',cmd:'REQUEST_LAST_REPORT'},location.origin);
  };

  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.source!=='STORYFLOW_EXT')return;
    const msg=event.data;
    if(msg.status==='READY'){
      lastHeartbeat=Date.now();
      setExtensionState(true);
    } else if(msg.status==='PROGRESS'&&msg.progress){
      progressModal.hidden=false;updateProgress(msg.progress);
    } else if(msg.status==='LAST_REPORT'){
      if(!msg.available){$('progressLast').textContent='Nessuna esecuzione precedente.';return;}
      if(msg.summary?.err>0) updateProgress({stage:'error',failedStage:msg.lastError?.stage||'start',message:msg.lastError?.message||msg.errorLine,log:msg.log});
      else $('progressLast').textContent=`Completate: ${msg.summary?.ok||0}. Errori: ${msg.summary?.err||0}.`;
    }
  });

  function detectEngine() {
    if(isNativeApp()){ setExtensionState(true); return; }
    window.postMessage({source:'STORYFLOW_SAAS',cmd:'PING_EXTENSION'},location.origin);
  }
  detectEngine();
  setInterval(detectEngine,3500);
  $('btnRecheckExtension').onclick=detectEngine;

  const modal=$('extensionModal');
  $('btnExtension').onclick=()=>{modal.hidden=false;};
  $('btnOpenExtensionGate').onclick=()=>{modal.hidden=false;};
  $('btnCloseExtension').onclick=()=>{modal.hidden=true;};

  siteUrl.value=store.lastSite||DEFAULT_SITE;
  currentStyle=safeStyle(getProfile().defaults);
  buildPatternGrid();syncUI();loadLogo();loadBackground();updateQueueUI();
})();