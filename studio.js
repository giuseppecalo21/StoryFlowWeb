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
  const cfgWatermarkEnabled = $('cfgWatermarkEnabled');
  const cfgWatermarkOpacity = $('cfgWatermarkOpacity');
  const cfgWatermarkSize = $('cfgWatermarkSize');
  const cfgWatermarkPosition = $('cfgWatermarkPosition');
  const STORE_KEY = 'storyflow.studio.settings.v2.2';

  const isNativeApp = () => Boolean(window.StoryFlowNative && typeof window.StoryFlowNative.startQueue === 'function');

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
      store.sites[id]={defaults:style,logoData:null,stories:{},metaTarget:id.includes('zonawrestling.net')?'Zona Wrestling e zona_wrestling':''};
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
      ctx.save();ctx.strokeStyle='rgba(255,255,255,.88)';ctx.lineWidth=3;ctx.setLineDash([10,8]);
      ctx.strokeRect(W/2-290,targetY-48,580,96);ctx.setLineDash([]);
      ctx.fillStyle='#fff';ctx.font=cssFont('Montserrat',25);ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('🔗 '+(c.stickerText||hostnameLabel())+' (Area Sticker 88%)',W/2,targetY,540);
      ctx.restore();
    }
  }

  function syncUI() {
    const c=currentStyle;
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
    resetPhoto();syncUI();persistStore();
  }
  $('btnRestoreTexts').onclick=()=>{
    inpTitle.value=currentArticle?.title||'';
    currentStyle.ctaText=getProfile().defaults.ctaText;
    currentStyle.stickerText=getProfile().defaults.stickerText;
    syncUI();saveCurrentStory();
  };
  function saveDefaults() {
    const p=getProfile();p.defaults=safeStyle(currentStyle);p.metaTarget=cfgMetaTarget.value.trim();
    if(persistStore())alert('Stile predefinito salvato per '+hostnameLabel());
  }
  $('btnSaveDefaults').onclick=saveDefaults;$('btnSaveDefaultsVisible').onclick=saveDefaults;
  $('btnResetStory').onclick=restoreCurrent;$('btnResetStoryVisible').onclick=restoreCurrent;
  $('btnResetPhoto').onclick=()=>{resetPhoto();saveCurrentStory();};
  $('btnSettings').onclick=()=>{const el=$('boxSettings');el.style.display=el.style.display==='none'?'block':'none';};
  $('btnToggleEditor').onclick=()=>{
    const panel=$('advancedEditor'), open=panel.hidden;
    panel.hidden=!open;
    $('btnToggleEditor').setAttribute('aria-expanded',String(open));
    $('btnToggleEditor').classList.toggle('expanded',open);
  };

  $('cfgMetaTarget').addEventListener('input',()=>{getProfile().metaTarget=cfgMetaTarget.value.trim();persistStore();});
  inpTitle.addEventListener('input',()=>{renderStory();saveCurrentStory();});
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

  function selectArticle(it,cardEl,autoSwitchTab=false) {
    articleToken++;const token=articleToken;
    document.querySelectorAll('.news-card').forEach(c=>c.classList.remove('active'));
    cardEl?.classList.add('active');currentArticle=it;
    const override=getProfile().stories[String(it.id)];
    currentStyle=safeStyle(override?.style||getProfile().defaults);
    inpTitle.value=override && typeof override.title==='string'?override.title:it.title;
    const ps=override?.photoState;
    photoState=ps?{panX:Number(ps.panX)||0,panY:Number(ps.panY)||0,zoom:clamp(Number(ps.zoom)||1,.5,2.5)}:{panX:0,panY:0,zoom:1};
    loadedImg=null;syncUI();
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
        const card=document.createElement('div');card.className='news-card';
        const image=document.createElement('img');image.alt='';
        if(it.image)image.src=`proxy.php?action=img&url=${encodeURIComponent(it.image)}`;
        const column=document.createElement('div'),h=document.createElement('h4'),sub=document.createElement('div');
        h.textContent=it.title;sub.textContent='#'+it.id;sub.className='news-meta';column.append(h,sub);card.append(image,column);
        card.onclick=()=>selectArticle(it,card,true);listEl.appendChild(card);
        if(idx===0)selectArticle(it,card,false);
      });
    } catch(err){listEl.textContent='Errore lettura feed: '+err.message;}
  }
  $('btnFetch').onclick=fetchNews;
  siteUrl.addEventListener('change',()=>{
    if(siteKey()===normalizeSite(store.lastSite))return;
    store.lastSite=siteUrl.value.trim();persistStore();
    currentArticle=null;articleToken++;loadedImg=null;photoPromise=Promise.resolve();
    $('newsList').textContent='Premi “Carica notizie” per il nuovo sito.';
    currentStyle=safeStyle(getProfile().defaults);inpTitle.value='';resetPhoto();syncUI();loadLogo();loadBackground();
  });

  $('btnAiRewrite').onclick=async()=>{
    const key=cfgGeminiKey.value.trim();
    if(!key) {$('boxSettings').style.display='block';alert('Inserisci la Gemini API Key nelle impostazioni.');return;}
    const button=$('btnAiRewrite');button.disabled=true;button.textContent='⏳...';
    try {
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:`Riscrivi questo titolo di notizia per una Instagram/Facebook Story in italiano. Mantieni il senso giornalistico fedele, massimo 110 caratteri, diretto e d'impatto, restituisci SOLO il titolo senza virgolette esterne:\n\n${inpTitle.value}` }]}]})
      });
      const json=await response.json();
      if(!response.ok)throw Error(json.error?.message||'Errore API');
      const result=json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if(result){inpTitle.value=result;renderStory();saveCurrentStory();}
    }catch(err){alert('Errore Gemini API: '+err.message);}
    finally{button.disabled=false;button.textContent='Riscrivi con AI';}
  };

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
  $('btnAddQueue').onclick=async()=>{
    if(!currentArticle)return alert('Seleziona prima una notizia!');
    const b=$('btnAddQueue');b.disabled=true;b.textContent='⏳ Elaborazione...';
    try {
      const jpg=await exportStoryDataUrl();
      queue.push({id:currentArticle.id,title:inpTitle.value.trim()||currentArticle.title,url:currentArticle.url,dataUrl:jpg,
        stickerText:currentStyle.stickerText.trim()||hostnameLabel(),metaTarget:cfgMetaTarget.value.trim()});
      updateQueueUI();
    }catch(e){alert('Errore preparazione storia: '+e.message);}
    finally{b.disabled=false;b.textContent='➕ Aggiungi Storia in Coda';}
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
    status.textContent=isNativeApp()?'App Mobile · Pronta':(extensionConnected?'Motore collegato':(label||'Motore da collegare'));
    if(!workflowActive)$('statStatus').textContent=extensionConnected?'Pronto':'In attesa';
    if(isNativeApp()){
      $('btnMetaLogin').hidden=false;
      $('btnRevealWork').hidden=false;
    }
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
    if(queue.some(it=>!it.metaTarget))return alert('Configura il nome della pagina/profili in “Impostazioni sito”, poi ricrea la coda.');
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