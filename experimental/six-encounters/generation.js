/* Seeded formal rules and a separate, bounded generative route session. No DOM. */
(function(root){
  function freeze(o){Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(o);}
  const config=freeze({version:'1.2.0',characterMotion:{axes:['horizontal','vertical','diagonal'],periods:[2400,3100,3700],tile:[3,3],clip:true},exposure:5000,entry:450,exit:350,historyLimit:32,traceLimit:3,
    backgrounds:Object.freeze(['#000000','#00ffff','#ff00ff','#ffff00']),
    routes:Object.freeze({'040915':Object.freeze([{word:'before',target:'041015'},{word:'again',target:'042115'}]),
      '041015':Object.freeze([{word:'whereiendandubegin',target:'040915'},{word:'whereiendandubegin',target:'042115'}]),
      '042115':Object.freeze([{word:'forced',target:'040915'},{word:'progress',target:'041015'}])})});
  function random(seed){let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function spaces(word,rng){const groups=[...word],missing=Math.floor(rng()*(groups.length-1));groups.splice(missing,2,groups[missing]+groups[missing+1]);return {missing,groups,text:groups.join(' ')};}
  function entrance(seed,word,colors){const rng=random(seed);return colors.map((background,index)=>({...spaces(word,rng),background,chamber:['040915','041015','042115'][index%3],seed,index}));}
  function luminance(hex){const rgb=hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function palette(background,seed){const rng=random(seed),result=[];for(let i=0;i<2000&&result.length<3;i++){
    const color='#'+Math.floor(rng()*0x1000000).toString(16).padStart(6,'0');
    if(contrast(background,color)>=4.5&&!result.includes(color))result.push(color);
  }const fallback=contrast(background,'#ffffff')>=4.5?['#ffffff','#eeeeee','#dddddd']:['#000000','#101010','#202020'];
    for(const c of fallback)if(result.length<3&&!result.includes(c)&&contrast(background,c)>=4.5)result.push(c);return result;
  }
  // Independent seeded streams avoid consuming/changing route and palette randomness.
  function character(seed,index,{axes=config.characterMotion.axes,periods=config.characterMotion.periods}={}){
    if(!axes.length || axes.some(a=>!config.characterMotion.axes.includes(a)) || periods.length!==axes.length || periods.some(p=>!Number.isFinite(p)||p<=0))throw new RangeError('Invalid character motion configuration');
    const rng=random((seed ^ Math.imul(index+1,0x9e3779b1))>>>0),slot=Math.floor(rng()*axes.length);
    return {axis:axes[slot],period:periods[slot],phase:rng(),direction:rng()<.5?-1:1};
  }
  // Normalized torus position: wave and stretch change velocity, never territories.
  function characterPosition(plan,time,family='drift'){
    const t=((time/plan.period+plan.phase)%1+1)%1;
    const wave=v=>v-Math.sin(2*Math.PI*v)/(2*Math.PI),lo=Math.floor(t*8)/8;
    const u=family==='wave'?wave(lo)+(wave(lo+1/8)-wave(lo))*(t-lo)*8:family==='stretch'?(t<.5?t*.5:.25+(t-.5)*1.5):t;
    return {x:plan.axis==='vertical'?0:u*plan.direction,y:plan.axis==='horizontal'?0:u*plan.direction};
  }
  let serial=0;
  class RouteSession {
    constructor(){this.run=++serial;this.count=0;this.active=null;this.visits={};this.history=[];}
    begin(chamber,background,seed){if(this.active||!config.routes[chamber]||!config.backgrounds.includes(background))return null;
      const rng=random(seed),links=config.routes[chamber].map(r=>({...r,background:config.backgrounds[Math.floor(rng()*4)],seed:Math.floor(rng()*0x100000000)}));
      this.active={id:`free:${this.run}:${++this.count}`,chamber,background,seed,colors:palette(background,seed),links,
        motion:['wave','drift','stretch'][Math.floor(rng()*3)],direction:Math.floor(rng()*4),phase:'entering',elapsed:0,
        visit:this.visits[chamber]=(this.visits[chamber]||0)+1,pending:null};return this.active;
    }
    ready(id){if(this.active?.id!==id||this.active.phase!=='entering')return false;this.active.phase='active';this.active.elapsed=0;return true;}
    choose(id,index){if(this.active?.id!==id||this.active.phase!=='active'||!this.active.links[index])return false;
      this.active.pending={...this.active.links[index]};this.active.reason='word';this.active.phase='exiting';return true;}
    depart(id,reason='unselected'){if(this.active?.id!==id||this.active.phase==='exiting')return false;
      this.active.pending=null;this.active.reason=reason;this.active.phase='exiting';return true;}
    finish(id){if(this.active?.id!==id||this.active.phase!=='exiting')return null;
      const event=structuredClone(this.active);this.history.push(event);this.history=this.history.slice(-config.historyLimit);this.active=null;return {event,next:event.pending};}
    exit(){this.active=null;}
    snapshot(){return structuredClone({configVersion:config.version,count:this.count,visits:this.visits,active:this.active,history:this.history,traces:this.history.slice(-config.traceLimit)});}
  }
  root.HLGeneration={config,random,spaces,entrance,palette,contrast,character,characterPosition,RouteSession};
  if(typeof module!=='undefined')module.exports=root.HLGeneration;
})(typeof window==='undefined'?globalThis:window);
