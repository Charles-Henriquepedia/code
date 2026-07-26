// Monitor mobile HTML/CSS/JS template (auto-generated, edit and rebuild)
// Loaded at startup and assembled in renderMobileHTML(wsUrl, token)

// Module-level: the bundler extracts htmlShell to module scope, and the
// template concatenates these variables into WS URLs and fetch calls.
export let tokSuffix = ''
export let wsUrl = ''

export const htmlStyles = '' +
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0d1117;color:#c9d1d9;padding:0 0 68px;overflow-x:hidden;-webkit-text-size-adjust:100%;-webkit-font-smoothing:antialiased}' +
    'input,textarea,select{font-size:16px!important}' +
    '.h{position:sticky;top:0;z-index:10;background:#0d1117;padding:8px 12px;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px}' +
    '.h h1{font-size:1em;color:#f0f6fc;font-weight:600;margin:0}' +
    '.cd{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}' +
    '.cog{background:#3fb950;box-shadow:0 0 6px #3fb950}' +
    '.crd{background:#da3633;box-shadow:0 0 6px #da3633}' +
    '.s{display:flex;gap:6px;margin-left:auto;font-size:.72em;color:#8b949e}' +
    '.s span{white-space:nowrap}' +
    '.s b{color:#e6edf3}' +
    '#lx{padding:6px 12px}' +
    '.c{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:8px 12px;margin-bottom:6px;cursor:pointer;transition:opacity .2s,transform .15s;position:relative;overflow:hidden}' +
    '.c:active{transform:scale(.98)}' +
    '.cr{border-left:4px solid #3fb950}' +
    '.cw{border-left:4px solid #d29922}' +
    '.cs{border-left:4px solid #484f58;opacity:.65}' +
    '.n{font-size:.68em;color:#8b949e;font-family:ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,monospace;margin-bottom:2px}' +
    '.d{font-size:.82em;color:#e6edf3;word-break:break-all;margin-bottom:2px;line-height:1.3}' +
    '.m{font-size:.68em;color:#8b949e;display:flex;gap:8px;flex-wrap:wrap}' +
    '.q{font-size:.75em;color:#8b949e;padding:5px;background:#0d1117;border-radius:4px;margin-top:3px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
    '.e{text-align:center;margin-top:40px;color:#8b949e;font-size:.9em}' +
    '.bt{position:fixed;bottom:0;left:0;right:0;z-index:10;background:#0d1117;border-top:1px solid #30363d;padding:6px 10px 8px;display:flex;flex-direction:column;gap:4px}' +
    '.bt1{display:flex;align-items:center;gap:6px}' +
    '.bt2{display:flex;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;padding-bottom:2px;scrollbar-width:none}' +
    '.bt2::-webkit-scrollbar{display:none}' +
    '.tb{flex:1;height:4px;background:#21262d;border-radius:2px;overflow:hidden;min-width:40px}' +
    '.tbf{height:100%;background:#3fb950;border-radius:2px;transition:width .5s;width:30%}' +
    '.ts{font-size:.65em;color:#8b949e;white-space:nowrap}' +
    '.ms{font-size:.7em;padding:2px 6px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;max-width:100px}' +
    '.pb{font-size:.65em;padding:3px 8px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;cursor:pointer;white-space:nowrap;transition:all .15s;flex-shrink:0}' +
    '.pb:hover{background:#21262d}' +
    '.pa{background:#1f6feb;border-color:#1f6feb;color:#fff}' +
    '.kb{font-size:.65em;padding:3px 8px;border:1px solid #da3633;border-radius:4px;background:#da3633;color:#fff;cursor:pointer;white-space:nowrap}' +
    '.kb:hover{background:#b62324}' +
    '.mt{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;pointer-events:none}' +
    '.mt.o{pointer-events:auto}' +
    '.mbd{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);opacity:0;transition:opacity .3s}' +
    '.mt.o .mbd{opacity:1}' +
    '.mct{position:absolute;bottom:0;left:0;right:0;height:85dvh;max-height:85dvh;background:#161b22;border-radius:12px 12px 0 0;transform:translateY(100%);transition:transform .3s ease;display:flex;flex-direction:column;overflow:hidden}' +
    '.mt.o .mct{transform:translateY(0)}' +
    '.mhd{display:flex;align-items:center;gap:8px;padding:10px 12px 8px;border-bottom:1px solid #30363d;flex-shrink:0}' +
    '.mhd .n{font-size:.78em}' +
    '.mhi{flex:1;min-width:0}' +
    '.mhi .d{font-size:.72em}' +
    '.mhi .m{font-size:.62em}' +
    '.mcl{flex:1;overflow-y:auto;padding:8px 12px;-webkit-overflow-scrolling:touch}' +
    '.ch{display:flex;flex-direction:column;margin-bottom:10px}' +
    '.chb{max-width:85%;padding:10px 14px;border-radius:14px;font-size:.85em;line-height:1.45;word-break:break-word;color:#c9d1d9;align-self:flex-start;background:#1e2433;box-shadow:0 1px 2px rgba(0,0,0,.2)}' +
    '.cu{align-self:flex-end}.cu .chb{background:#1a3a5c;color:#e6edf3;border-bottom-right-radius:4px;border:1px solid #2d5a8a}' +
    '.ca{align-self:flex-start}.ca .chb{background:#1e2433;border-bottom-left-radius:4px;border:1px solid #2a3142}' +
    '.ca .cht{color:#6e7681}.cu .cht{color:#6e7681;text-align:right}' +
    '.chb code{background:#0d1117;padding:1px 4px;border-radius:3px;font-size:.9em}' +
    '.chb pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;margin-top:4px}' +
    '.chb pre code{background:none;padding:0}' +
    '.cht{font-size:.62em;color:#8b949e;margin-top:2px;cursor:help}' +
    '.ch[data-pending="1"] .chb{border-left:2px solid #d29922}' +
    '.ch[data-pending="1"] .cht::before{content:"●";color:#d29922;margin-right:3px;font-size:.8em}' +
    '.ch[data-done="1"] .chb{border-left:2px solid #3fb950}' +
    '.ch[data-done="1"] .cht::after{content:" ✓";color:#3fb950;margin-left:3px;font-size:.7em}' +
    '.ch[data-err="1"] .chb{border-left:2px solid #da3633}' +
    '.btx{white-space:pre-wrap}' +
    '.bth{font-style:italic;color:#8b949e;font-size:.82em;padding:6px 10px;white-space:pre-wrap;background:#161b22;border-left:2px solid #6e7681;border-radius:0 4px 4px 0;margin:4px 0;line-height:1.4}' +
    '.btu{margin:6px 0;border:1px solid #30363d;border-radius:6px;overflow:hidden;background:#0d1117}' +
    '.btuh{padding:6px 10px;font-size:.78em;background:#161b22;color:#d2a8ff;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none;-webkit-user-select:none;gap:6px}' +
    '.btuh::after{content:"\\25b6";font-size:.6em;color:#8b949e;transition:transform .15s;flex-shrink:0}' +
    '.btu.open .btuh::after{transform:rotate(90deg)}' +
    '.btup{padding:6px 10px;font-size:.72em;margin:0;white-space:pre-wrap;word-break:break-word;background:#0d1117;color:#8b949e;border-top:1px solid #21262d}' +
    '.btu .btup{display:none}' +
    '.btu.open .btup{display:block}' +
    '.tr{margin:4px 0}' +
    '.trh{font-size:.7em;color:#8b949e;padding:5px 8px;cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;-webkit-user-select:none;background:#161b22;border:1px solid #30363d;border-radius:6px;transition:background .15s}' +
    '.trh:hover{background:#21262d}' +
    '.trh::after{content:"\\25b6";font-size:.55em;color:#6e7681;transition:transform .15s;margin-left:auto;flex-shrink:0}' +
    '.tr.open .trh::after{transform:rotate(90deg)}' +
    '.tr .trb{display:none;margin-top:4px;padding:6px 10px;background:#0d1117;border:1px solid #30363d;border-radius:4px;font-size:.72em;color:#8b949e;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow-y:auto}' +
    '.tr.open .trb{display:block}' +
    '.ci{align-self:center!important;max-width:90%}' +
    '.ci .chb{background:#0d1117!important;border:1px dashed #30363d;color:#6e7681!important;font-size:.72em!important;padding:4px 10px;border-radius:6px;text-align:center}' +
    '.chip{display:inline-block;padding:3px 8px;border:1px solid #30363d;border-radius:12px;background:#161b22;color:#8b949e;font-size:.72em;cursor:pointer;white-space:nowrap;transition:all .15s;margin:2px}' +
    '.chip:hover{background:#21262d;color:#c9d1d9;border-color:#58a6ff}' +
    '.chips{padding:4px 14px 6px;display:flex;gap:4px;flex-wrap:wrap}' +
    '.trb{font-size:.78em;color:#8b949e;white-space:pre-wrap;padding:4px 8px;background:#161b22;border-radius:4px;overflow-x:auto}' +
    '.mib{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid #30363d;flex-shrink:0;background:#161b22}' +
    '.mip{flex:1;padding:10px 12px;border:1px solid #30363d;border-radius:8px;background:#0d1117;color:#c9d1d9;font-size:16px;outline:none;-webkit-appearance:none;appearance:none;min-height:44px}' +
    '.mip:focus{border-color:#1f6feb}' +
    '.msb{padding:8px 14px;border:none;border-radius:8px;background:#238636;color:#fff;font-size:.85em;cursor:pointer;min-height:44px;flex-shrink:0}' +
    '.msb:hover{background:#2ea043}' +
    '.dpr{display:flex;gap:6px;padding:4px 10px 6px;justify-content:center;flex-shrink:0;overflow-x:auto}' +
    '.dpb{width:36px;height:36px;border-radius:50%;border:1px solid #30363d;background:#0d1117;color:#c9d1d9;font-size:.75em;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .1s;flex-shrink:0}' +
    '.dpb:hover{background:#21262d;border-color:#8b949e}' +
    '.dpb:active{background:#30363d}' +
    '.stp{padding:6px 12px;border:none;border-radius:6px;background:#da3633;color:#fff;font-size:.75em;cursor:pointer;white-space:nowrap;min-height:36px;flex-shrink:0}' +
    '.stp:hover{background:#b62324}' +
    '.scb{padding:6px 10px;border:1px solid #30363d;border-radius:6px;background:#0d1117;color:#8b949e;font-size:.72em;cursor:pointer;white-space:nowrap;min-height:36px;flex-shrink:0}' +
    '.scb:hover{background:#21262d}' +
    '.wrn{background:#3d1f00;border:1px solid #d29922;color:#d29922;padding:5px 8px;border-radius:6px;font-size:.72em;margin:4px 0;display:flex;align-items:center;gap:6px}' +
    '.wrn::before{content:"!";font-weight:700;background:#d29922;color:#0d1117;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7em;flex-shrink:0}' +
    '.mhd .cd{margin-right:4px}' +
    '.mxa{background:none;border:none;color:#8b949e;font-size:1.2em;cursor:pointer;padding:4px;line-height:1}' +
    '.mxa:hover{color:#e6edf3}' +
    // Grid view styles
    '.gb{background:none;border:1px solid #30363d;color:#8b949e;font-size:.7em;padding:3px 8px;border-radius:4px;cursor:pointer;white-space:nowrap;flex-shrink:0}' +
    '.gb:hover{background:#21262d;color:#c9d1d9}' +
    '.gb.on{background:#1f6feb;border-color:#1f6feb;color:#fff}' +
    '.gv{display:grid;gap:6px;padding:6px;grid-template-columns:1fr;overflow-y:auto;overflow-x:hidden}' +
    '.gc{background:#161b22;border:1px solid #30363d;border-radius:8px;display:flex;flex-direction:column;overflow:hidden;min-height:200px}' +
    '.gch{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid #30363d;flex-shrink:0;font-size:.68em;background:#0d1117}' +
    '.gch .n{font-size:.7em;color:#8b949e;font-family:ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,monospace;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.gch .st{width:6px;height:6px;border-radius:50%;flex-shrink:0}' +
    '.gch .mo{font-size:.6em;color:#6e7681;flex-shrink:0}' +
    '.gcl{flex:1;overflow-y:auto;padding:4px 6px;min-height:0}' +
    '.gcl .ch{margin-bottom:4px}' +
    '.gcl .chb{font-size:.75em;padding:4px 8px;border-radius:8px;max-width:90%}' +
    '.gcl .cht{font-size:.55em}' +
    '.gcl .btx{font-size:.75em}' +
    '.gcl .bth{font-size:.75em;padding:1px 0}' +
    '.gcl .btu{margin:2px 0}' +
    '.gcl .btuh{font-size:.7em;padding:2px 6px}' +
    '.gcl .btup{font-size:.65em;padding:2px 6px}' +
    '.gcl .trh{font-size:.6em}' +
    '.gcl .chb code{font-size:.85em}' +
    '.gib{display:flex;align-items:center;gap:4px;padding:3px 6px;border-top:1px solid #30363d;flex-shrink:0;background:#0d1117}' +
    '.gip{flex:1;padding:6px 8px;border:1px solid #30363d;border-radius:6px;background:#0d1117;color:#c9d1d9;font-size:13px;outline:none;min-height:32px}' +
    '.gip:focus{border-color:#1f6feb}' +
    '.gsb{padding:4px 10px;border:none;border-radius:6px;background:#238636;color:#fff;font-size:.7em;cursor:pointer;min-height:32px;flex-shrink:0}' +
    '.gsb:hover{background:#2ea043}' +
    '.gst{padding:3px 8px;border:none;border-radius:6px;background:#da3633;color:#fff;font-size:.65em;cursor:pointer;min-height:28px;flex-shrink:0}' +
    '.gst:hover{background:#b62324}' +
    '.gdp{display:flex;gap:3px;padding:2px 6px 4px;justify-content:center;flex-shrink:0}' +
    '.gdp button{width:28px;height:28px;border-radius:50%;border:1px solid #30363d;background:#0d1117;color:#c9d1d9;font-size:.6em;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
    '.gdp button:hover{background:#21262d;border-color:#8b949e}' +
    '.gdp button:active{background:#30363d}' +
    '@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}' +
    '.c{animation:fi .2s ease}' +
    '@media(min-width:768px){.mct{width:auto;height:80vh;max-height:800px;left:5vw;right:5vw;border-radius:12px 12px 0 0}' +
    '#lx{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:1100px;margin:0 auto}' +
    '@media(min-width:1000px){.mct{left:calc((100vw - 900px)/2);right:calc((100vw - 900px)/2);width:900px}}' +
    '@media(min-width:1024px){.mct{height:75vh}}' +
    '@media(min-width:1200px){.mct{left:calc((100vw - 1100px)/2);right:calc((100vw - 1100px)/2);width:1100px}}' +
    '@media(max-width:767px){#lx{display:flex;flex-direction:column}}' +
    '.mv{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:90;background:#0d1117;display:grid;gap:4px;padding:4px;grid-template-columns:1fr 1fr;overflow:hidden}@media(min-width:768px){.gv{grid-template-columns:1fr 1fr}}' +
    '@media(min-width:768px){.mv{grid-template-columns:1fr 1fr}}@media(max-width:767px){.mv{grid-template-columns:1fr}}'

  export const htmlShell = '' +
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">' +
    '<title>Monitor</title>' +
    '' +
    '' +
    '<style>' + htmlStyles + '</style>' +
    '</head>' +
    '<body>' +
    '<div class="h">' +
    '<span class="cd" id="cd"></span>' +
    '<h1>Monitor</h1>' +
    '<div class="s">' +
    '<span><b id="r0">0</b> run</span>' +
    '<span><b id="r1">0</b> wait</span>' +
    '<span><b id="r2">0</b> stop</span>' +
    '' +
    '</div>' +
    '</div>' +
    '<div id="lx"></div><div class="mv" id="mv" style="display:none"></div>' +
    '' +
    '<div id="af" style="padding:8px 12px;border-top:1px solid #30363d;display:none"><div style="font-size:.7em;color:#8b949e;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Activity</div><div id="afL" style="font-size:.75em;max-height:120px;overflow-y:auto"></div></div>' +
    '<div class="bt">' +
    '<div class="bt1">' +
    '<div class="tb"><div class="tbf" id="tbf"></div></div>' +
    '<span class="ts" id="ts">0 t/s</span>' +
    '<select class="ms" id="ms"></select>' +
    '<button class="kb" id="ka">Kill all</button>' +
    '</div>' +
    '<div class="bt2">' +
    '<button class="pb pa" data-mode="default">Default</button>' +
    '<button class="pb" data-mode="plan">Plan</button>' +
    '<button class="pb" data-mode="acceptEdits">Accept</button>' +
    '<button class="pb" data-mode="bypassPermissions">Bypass</button>' +
    '</div>' +
    '</div>' +
    '<div class="mt" id="mt">' +
    '<div class="mbd" id="mbd"></div>' +
    '<div class="mct" id="mct">' +
    '<div class="mhd">' +
    '<button class="mxa" id="mxa">&times;</button><div style="flex:1"></div><button class="mxa" id="spb" title="Split view">⊞</button>' +
    '<div class="mhi" id="mhi"></div>' +
    '' +
    '</div>' +
    '<div class="mcl" id="mcl"></div>' +
    '<div class="chips" id="chips">' +
    '<span class="chip" data-cmd="/model">/model</span>' +
    '<span class="chip" data-cmd="/resume">/resume</span>' +
    '<span class="chip" data-cmd="/compact">/compact</span>' +
    '<span class="chip" data-cmd="/clear">/clear</span>' +
    '</div>' +
    '<div class="wrn" id="wrn" style="display:none">Possible dangerous command detected</div>' +
    '<div class="dpr">' +
    '<button class="dpb" data-key="ArrowUp">&uarr;</button>' +
    '<button class="dpb" data-key="ArrowDown">&darr;</button>' +
    '<button class="dpb" data-key="ArrowLeft">&larr;</button>' +
    '<button class="dpb" data-key="ArrowRight">&rarr;</button>' +
    '<button class="dpb" data-key="Enter">Enter</button>' +
    '<button class="dpb" data-key="Escape">Esc</button>' +
    '<button class="dpb" data-key="CtrlC">Ctrl+C</button>' +
    '</div>' +
    '<div class="mib">' +
    '<input class="mip" id="mip" type="text" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" spellcheck="false" placeholder="Send text to session...">' +
    '<button class="msb" id="msb">Send</button>' +
    '<button class="stp" id="stp">Stop</button>' +
    '<button class="scb" id="scb">Capture</button>' +
    '<span id="usg" style="font-size:.68em;color:#8b949e;margin-left:auto;white-space:nowrap"></span>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<script>' +
    'var _S=[],_pt=null;' +
    'var _mi=-1;' +
    'var _md="default";' +
    'var _ml="claude-sonnet-4";' +
    'var _W=null;' +
    'var _ES=null;var _afEvents=[];' +
    // Activity feed SSE connection
    'function CA(){if(_ES)try{_ES.close()}catch(e){}_ES=new EventSource("/api/activity' + tokSuffix + '");_ES.onmessage=function(e){try{var ev=JSON.parse(e.data);_afEvents.push(ev);if(_afEvents.length>50)_afEvents.shift();RA()}catch(e){}}};' +
    'function RA(){var L=document.getElementById("afL");if(!L)return;var h="";for(var i=_afEvents.length-1;i>=0;i--){var ev=_afEvents[i];var t=new Date(ev.timestamp).toLocaleTimeString();var ic=ev.type=="session-start"?"\u25b6":ev.type=="session-stop"?"\u25a0":"\u21bb";var cl=ev.to=="running"?"#3fb950":ev.to=="waiting_input"?"#d29922":ev.to=="stopped"||ev.to=="removed"?"#da3633":"#8b949e";h+="<div style=\\"padding:2px 0;color:#8b949e\\"><span style=\\"color:"+cl+";margin-right:4px\\">"+ic+"</span><span style=\\"color:#58a6ff\\">"+(ev.sessionName||ev.sessionId.slice(0,8))+"</span> <span style=\\"color:#6e7681\\">"+t+"</span> <span>"+ev.from+" \u2192 "+ev.to+"</span></div>"}L.innerHTML=h;var af=document.getElementById("af");if(af)af.style.display=_afEvents.length?"block":"none"}' +
    'CA();' +
    'var _ML=["claude-sonnet-4","claude-haiku-3-5","gpt-4o","deepseek-chat","gemini-2-flash"];' +
    'function E_(s){if(!s)return"";return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll(\'"\',"&quot;")}' +
    'function F(t){if(!t)return"";var s=Math.floor((Date.now()-t)/1e3);if(s<60)return s+"s";var m=Math.floor(s/60);if(m<60)return m+"m";return Math.floor(m/60)+"h"}' +
    'function FR(ts){var t=typeof ts==="string"?new Date(ts).getTime():ts;if(!t)return"";var d=new Date(t);var abs=d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});var s=Math.floor((Date.now()-t)/1e3);if(s<5)return abs+" • now";if(s<60)return abs+" • "+s+"s";var m=Math.floor(s/60);if(m<60)return abs+" • "+m+"m";var h=Math.floor(m/60);if(h<24)return abs+" • "+h+"h";return abs+" • "+Math.floor(h/24)+"d"}' +
    // ANSI-to-HTML + HTML escape. Handles SGR: 0(reset), 1(bold), 22(normal), 3(italic), 4(underline)
    'function AA(t){var s=String(t),o="",fg="",bg="",b=0,it=0,un=0,dm=0;' +
    'var fgc=["#1f1f1f","#e34b4b","#3fb950","#d29922","#58a6ff","#bc8cff","#39c5cf","#e6edf3"];' +
    'var fgb=["#808080","#ff6b6b","#56d364","#e3b341","#79c0ff","#d2a8ff","#56d4dd","#ffffff"];' +
    'var bgc=["#1f1f1f","#e34b4b","#3fb950","#d29922","#58a6ff","#bc8cff","#39c5cf","#e6edf3"];' +
    'var bgb=["#808080","#ff6b6b","#56d364","#e3b341","#79c0ff","#d2a8ff","#56d4dd","#ffffff"];' +
    'function W(){var a="";if(b)a+="font-weight:bold;";if(it)a+="font-style:italic;";if(un)a+="text-decoration:underline;";if(dm)a+="opacity:.55;";if(fg)a+="color:"+fg+";";if(bg)a+="background:"+bg+";";return a?"<span style=\'"+a+"\'>":""}' +
    'for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c===27&&s.charCodeAt(i+1)===91){i+=2;var v="",fl="";while(i<s.length){var ch=s.charAt(i);if(ch>="a"&&ch<="z"||ch>="A"&&ch<="Z"){fl=ch;break}v+=ch;i++};' +
    'if(fl==="m"){if(b||it||un||dm||fg||bg)o+="</span>";b=0;it=0;un=0;dm=0;fg="";bg="";' +
    'var cs=v.split(";");for(var j=0;j<cs.length;j++){var n=parseInt(cs[j],10);' +
    'if(n===0){}else if(n===1){b=1}else if(n===2){dm=1}else if(n===22){b=0}else if(n===3){it=1}else if(n===23){it=0}else if(n===4){un=1}else if(n===24){un=0}' +
    'else if(n>=30&&n<=37){fg=fgc[n-30]}else if(n>=90&&n<=97){fg=fgb[n-90]}' +
    'else if(n>=40&&n<=47){bg=bgc[n-40]}else if(n>=100&&n<=107){bg=bgb[n-100]}}' +
    'var ws=W();if(ws)o+=ws}}else{o+=E_(s.charAt(i))}}' +
    'if(b||it||un||dm||fg||bg)o+="</span>";return o}' +
    'function P(p){if(!p)return"";if(p.length<=45)return E_(p);return E_(p.slice(0,20)+"..."+p.slice(-20))}' +
    'function I(i){if(!i)return"";return E_(i.slice(0,10))}' +
    'function M(t){if(!t)return"";var s=AA(t);s=s.replace(/```([\\s\\S]*?)```/g,"<pre><code>$1</code></pre>");s=s.replace(/`([^`]+)`/g,"<code>$1</code>");s=s.replace(/\\*\\*([^*]+)\\*\\*/g,"<b>$1</b>");s=s.replace(/\\*([^*]+)\\*/g,"<i>$1</i>");s=s.replace(/(https?:\\/\\/[^\\s<]+)/g,"<a href=\\"$1\\" target=\\"_blank\\" style=\\"color:#58a6ff\\">$1</a>");return s}' +
    'function W(t){if(!t)return false;var l=t.toLowerCase();return l.indexOf("rm -rf")>=0||l.indexOf("sudo")>=0||l.indexOf("> /dev/sda")>=0}' +
    'var _tn=0;function C(){if(_W)try{_W.close()}catch(e){}_W=new WebSocket("' + wsUrl.replace(/^http/, 'ws') + tokSuffix + '");_W.onopen=function(){var d=document.getElementById("cd");d.className="cd cog";if(_mi>=0){var x=_S[_mi];if(x)_W.send(JSON.stringify({type:"subscribe-transcript",sessionId:x.sessionId}))}};_W.onmessage=function(e){try{var d=JSON.parse(e.data);if(d.type=="update"){_S=d.sessions||[];R()}else if(d.type=="transcript-delta"){var sid=d.sessionId;if(sid&&_gm[sid]){var el=document.getElementById("gcl_"+sid);if(el){var es=d.entries||[];for(var i=0;i<es.length;i++){if(es[i].type=="user"||es[i].type=="assistant"){var e2=es[i];var b2=document.createElement("div");b2.className=e2.type=="user"?"ch cu":"ch ca";var bb2=document.createElement("div");bb2.className="chb";bb2.textContent=(e2.text||"").substring(0,200);b2.appendChild(bb2);el.appendChild(b2);var atB=el.scrollHeight-el.scrollTop-el.clientHeight<60;if(atB)el.scrollTop=el.scrollHeight}};_gm[sid].lmc+=es.length}}if(sid&&_mi>=0){var x=_S[_mi];if(x&&sid==x.sessionId){var es=d.entries||[];for(var i=0;i<es.length;i++){AD(es[i]);}_lmc+=es.length}}}else if(d.type=="transcript-error"){console.warn("transcript:",d.error)}}catch(e){}};_W.onclose=function(){var d=document.getElementById("cd");d.className="cd crd";setTimeout(C,2000)};_W.onerror=function(){var d=document.getElementById("cd");d.className="cd crd"}}' +
    'function R(){var S=_S;' +
    'document.getElementById("r0").textContent=S.filter(function(x){return x.status=="running"}).length;' +
    'document.getElementById("r1").textContent=S.filter(function(x){return x.status=="waiting_input"}).length;' +
    'document.getElementById("r2").textContent=S.filter(function(x){return x.status=="stopped"}).length;' +
    'var E=document.getElementById("lx");E.textContent="";' +
    'if(!S.length){E.innerHTML="<div class=e>No active sessions</div>";return}' +
    'for(var i=0;i<S.length;i++){var x=S[i];' +
    'var a=x.status=="running"?"cr":x.status=="waiting_input"?"cw":"cs";' +
    'var c=document.createElement("div");c.className="c "+a;c.setAttribute("data-i",i);' +
    'var displayName=x.name?E_(x.name):I(x.sessionId);' +
    'c.innerHTML="<div class=n>"+(x.name?"<b>"+displayName+"</b> ":"")+I(x.sessionId)+(x.pid?" PID"+x.pid:"")+"</div>"+' +
    '"<div class=d>"+P(x.cwd)+"</div>"+' +
    '"<div class=m>"+FR(x.updatedAt||x.createdAt)+(x.model?" \u00b7 "+E_(x.model):"")+(x.name?" \u00b7 "+E_(x.name):"")+"</div>"+' +
    '(x.lastMessage?"<div class=q>"+M(x.lastMessage.slice(0,120))+"</div>":"");' +
    'c.onclick=function(){var idx=parseInt(this.getAttribute("data-i"));O(idx)};' +
    'E.appendChild(c)}' +
    'var mv=document.getElementById("mv");if(mv&&mv.style.display=="grid")GG();' +
    'if(_mi>=0){var ms=S[_mi];if(ms){var h=document.getElementById("mhi");' +
    'h.innerHTML="<div style=\\"display:flex;align-items:center;gap:6px;margin-bottom:2px\\">"+(ms.status=="running"?"<span class=\\"cd cog\\"></span>":ms.status=="waiting_input"?"<span class=\\"cd\\" style=\\"background:#d29922\\"></span>":"<span class=\\"cd\\" style=\\"background:#484f58\\"></span>")+"<span class=n>"+E_(ms.sessionId)+"</span></div>"+' +
    '"<div class=d>"+P(ms.cwd)+"</div>"+' +
    '"<div class=m>PID "+ms.pid+", "+F(ms.createdAt)+(ms.model?" "+E_(ms.model):"")+"</div>";' +
    'var mc=document.getElementById("mcl");mc.textContent="";' +
    'if(ms.lastMessage){var b=document.createElement("div");b.className="ch";' +
    'var bb=document.createElement("div");bb.className="chb";bb.innerHTML=M(ms.lastMessage);b.appendChild(bb);' +
    'var bt=document.createElement("div");bt.className="cht";bt.textContent=new Date(ms.updatedAt).toLocaleTimeString();b.appendChild(bt);' +
    'mc.appendChild(b)}' +
    'var w=document.getElementById("wrn");w.style.display=W(ms.lastMessage)?"flex":"none"' +
    '}}}' +
    'function O(i){_mi=i;var x=_S[i];if(!x)return;var mt=document.getElementById("mt");mt.className="mt o";var mcg=document.getElementById("mcg");if(mcg)mcg.style.display="none";var mcl=document.getElementById("mcl");if(mcl)mcl.style.display="block";' +
    'var h=document.getElementById("mhi");' +
    'h.innerHTML="<div style=\\"display:flex;align-items:center;gap:6px;margin-bottom:2px\\">"+(x.status=="running"?"<span class=\\"cd cog\\"></span>":x.status=="waiting_input"?"<span class=\\"cd\\" style=\\"background:#d29922\\"></span>":"<span class=\\"cd\\" style=\\"background:#484f58\\"></span>")+"<span class=n>"+E_(x.sessionId)+"</span></div>"+' +
    '"<div class=d>"+P(x.cwd)+"</div>"+' +
    '"<div class=m>PID "+x.pid+", "+F(x.createdAt)+(x.model?" "+E_(x.model):"")+"</div>";' +
    // Fetch usage for this session
    'fetch("/api/sessions/"+encodeURIComponent(x.sessionId)+"/usage' + tokSuffix + '").then(function(r){return r.json()}).then(function(u){if(u.ok){var ug=document.getElementById("usg");if(ug)ug.textContent=u.totalTokens.toLocaleString()+" tok, $"+u.estimatedCostUsd.toFixed(4)}}).catch(function(){});' +
    'var mc=document.getElementById("mcl");mc.textContent="";var _lmc=0;' +
    // Auto-focus input and show chips when opening
    'setTimeout(function(){var inp=document.getElementById("mip");if(inp){inp.focus();inp.value=""}},100);' +
    // Render a single transcript entry (any type) as a DOM node
    'function RE(e){' +
    // Detect system-injected user messages (command wrappers, caveats, goal args)
    'function ISST(t){if(!t)return false;return t.indexOf("<command-message>")>=0||t.indexOf("<command-args>")>=0||t.indexOf("<local-command-caveat>")>=0||t.indexOf("<local-command-stdout>")>=0||t.indexOf("<local-command-stderr>")>=0||t.indexOf("<goal_arguments>")>=0||t.indexOf("<command-name>")>=0}' +
    'function PSCMD(t){var m=t.match(/<command-name>\\s*([^<]+?)\\s*<\\/command-name>/);if(m)return m[1];m=t.match(/<command-message>\\s*([^<]+?)\\s*<\\/command-message>/);if(m)return m[1];return null}' +
    // user text
    'if(e.type=="user"&&e.text){' +
    // System-injected user messages (slash command wrappers) — render as compact system line
    'if(ISST(e.text)){var b=document.createElement("div");b.className="ch ci";' +
    'var bb=document.createElement("div");bb.className="chb";' +
    'var cmd=PSCMD(e.text);var label=cmd?"/"+cmd:"system command";' +
    'var hd=document.createElement("div");hd.textContent="\u2699 "+label;bb.appendChild(hd);' +
    'var btS=document.createElement("div");btS.style.fontSize=".62em";btS.style.color="#6e7681";btS.style.marginTop="1px";btS.textContent=FR(e.timestamp);bb.appendChild(btS);' +
    'b.appendChild(bb);return b}' +
    'var b=document.createElement("div");b.className="ch cu";b.setAttribute("data-pending","1");' +
    'var bb=document.createElement("div");bb.className="chb";bb.innerHTML=M(e.text);b.appendChild(bb);' +
    'var bt=document.createElement("div");bt.className="cht";bt.title=new Date(e.timestamp).toLocaleString();bt.textContent=FR(e.timestamp);b.appendChild(bt);return b}' +
    // user tool_result — collapsible summary
    'if(e.type=="user"&&e.toolResult){var b=document.createElement("div");b.className="ch tr";' +
    'var bb=document.createElement("div");bb.className="chb";bb.style.padding="0";bb.style.background="transparent";bb.style.border="none";bb.style.boxShadow="none";' +
    'var content=String(e.toolResult.content||"");' +
    'var summary=content.slice(0,80)+(content.length>80?"\u2026":"");' +
    'var hd=document.createElement("div");hd.className="trh";' +
    'var ic=document.createElement("span");ic.textContent=e.toolResult.isError?"\u274c":"\u2705";ic.style.flexShrink="0";' +
    'var tx=document.createElement("span");tx.textContent=summary;tx.style.flex="1";tx.style.overflow="hidden";tx.style.textOverflow="ellipsis";tx.style.whiteSpace="nowrap";' +
    'hd.appendChild(ic);hd.appendChild(tx);' +
    'var bd=document.createElement("div");bd.className="trb";bd.textContent=content.slice(0,3000);' +
    'hd.onclick=function(){b.classList.toggle("open")};' +
    'bb.appendChild(hd);bb.appendChild(bd);b.appendChild(bb);return b}' +
    // assistant with blocks
    'if(e.type=="assistant"){var b=document.createElement("div");b.className="ch ca";' +
    'var bb=document.createElement("div");bb.className="chb";' +
    'var bs=e.blocks||[];' +
    'for(var bi=0;bi<bs.length;bi++){var bl=bs[bi];' +
    'if(bl.kind=="text"){var d=document.createElement("div");d.className="btx";d.innerHTML=M(bl.text||"");bb.appendChild(d)}' +
    'else if(bl.kind=="thinking"){var d=document.createElement("div");d.className="bth";d.textContent="\ud83d\udcad "+String(bl.thinking||"").slice(0,200)+(bl.thinking&&bl.thinking.length>200?"\u2026":"");bb.appendChild(d)}' +
    'else if(bl.kind=="tool_use"){var d=document.createElement("div");d.className="btu";' +
    'var tn=bl.toolName||"tool";' +
    'var keys=bl.toolInput?Object.keys(bl.toolInput||{}).slice(0,4).join(", "):"";' +
    'var summary=tn+(keys?" \u00b7 "+keys:"");' +
    'var h=document.createElement("div");h.className="btuh";' +
    'var ic=document.createElement("span");ic.textContent="\ud83d\udd27";ic.style.marginRight="6px";' +
    'var lbl=document.createElement("span");lbl.textContent=summary;lbl.style.flex="1";lbl.style.overflow="hidden";lbl.style.textOverflow="ellipsis";lbl.style.whiteSpace="nowrap";' +
    'h.appendChild(ic);h.appendChild(lbl);' +
    'var p=document.createElement("pre");p.className="btup";try{p.textContent=JSON.stringify(bl.toolInput,null,2).slice(0,800)}catch(_){p.textContent=String(bl.toolInput)};' +
    'h.onclick=function(){d.classList.toggle("open")};' +
    'd.appendChild(h);d.appendChild(p);bb.appendChild(d)}' +
    'else if(bl.kind=="redacted_thinking"){var d=document.createElement("div");d.className="bth";d.textContent="[redacted thinking]";bb.appendChild(d)}' +
    '}' +
    'if(!bb.childNodes.length&&e.text){var d=document.createElement("div");d.className="btx";d.innerHTML=M(e.text);bb.appendChild(d)}' +
    'b.appendChild(bb);' +
    'var bt=document.createElement("div");bt.className="cht";bt.textContent=(e.model?e.model+" · ":"")+FR(e.timestamp);b.appendChild(bt);return b}' +
    // system — show as compact info line
    'if(e.type=="system"){var b=document.createElement("div");b.className="ch ci";' +
    'var bb=document.createElement("div");bb.className="chb";bb.style.background="#0d1117";bb.style.fontSize=".75em";bb.style.color="#8b949e";' +
    'var hd=document.createElement("div");hd.textContent="["+(e.subtype||"system")+"]"+(e.level?" "+e.level:"");bb.appendChild(hd);' +
    'var btS=document.createElement("div");btS.style.fontSize=".62em";btS.style.color="#6e7681";btS.style.marginTop="1px";btS.textContent=FR(e.timestamp);bb.appendChild(btS);' +
    'b.appendChild(bb);return b}' +
    // summary — show as compact info line
    'if(e.type=="summary"){var b=document.createElement("div");b.className="ch ci";' +
    'var bb=document.createElement("div");bb.className="chb";bb.style.background="#0d1117";bb.style.fontSize=".75em";bb.style.color="#8b949e";' +
    'var hd=document.createElement("div");hd.textContent=e.text?e.text.slice(0,120)+(e.text.length>120?"…":""):"(summary)";bb.appendChild(hd);' +
    'var btS=document.createElement("div");btS.style.fontSize=".62em";btS.style.color="#6e7681";btS.style.marginTop="1px";btS.textContent=FR(e.timestamp);bb.appendChild(btS);' +
    'b.appendChild(bb);return b}' +
    // mode — show model changes
    'if(e.type=="mode"){var b=document.createElement("div");b.className="ch ci";' +
    'var bb=document.createElement("div");bb.className="chb";bb.style.background="#0d1117";bb.style.fontSize=".75em";bb.style.color="#d2a8ff";' +
    'bb.textContent="[mode] "+(e.raw?.model||"model changed");b.appendChild(bb);' +
    'var btS=document.createElement("div");btS.style.fontSize=".62em";btS.style.color="#6e7681";btS.style.marginTop="1px";btS.textContent=FR(e.timestamp);bb.appendChild(btS);' +
    'return b}' +
    'return null}' +
    // Fetch full transcript (initial load)
    'function FL(){if(!x)return;fetch("/api/sessions/"+encodeURIComponent(x.sessionId)+"/full?limit=150' + (tokSuffix ? "&"+tokSuffix.slice(1) : "") + '").then(function(r){return r.json()}).then(function(d){' +
    'var es=d.entries||[];var chat=es.filter(function(e){return e.type=="user"||e.type=="assistant"});' +
    'if(!chat.length)return;' +
    'if(chat.length==_lmc)return;_lmc=chat.length;' +
    'mc.textContent="";' +
    '// Render incrementally to avoid freezing UI on long sessions' +
    'var i=0;function renderNext(){if(i>=chat.length){mc.scrollTop=mc.scrollHeight;return}' +
    'var batch=chat.slice(i,i+20);for(var bi=0;bi<batch.length;bi++){var n=RE(batch[bi]);if(n)mc.appendChild(n)}' +
    'i+=20;if(i%100===0)mc.scrollTop=mc.scrollHeight;requestAnimationFrame(renderNext)}' +
    'renderNext();});}' +
    // Append a single delta entry (from WS)
    'function AD(e){if(e.type!="user"&&e.type!="assistant")return;' +
    // Confirma otimistas pendentes (data-pending -> data-done) sem duplicar
    'var mc=document.getElementById("mcl");if(!mc)return;' +
    'if(e.type=="user"&&e.text){var pending=mc.querySelector(".ch.cu[data-pending=\\"1\\"]:last-of-type");if(pending){pending.removeAttribute("data-pending");pending.setAttribute("data-done","1");var pbt=pending.querySelector(".cht");if(pbt)pbt.textContent="sent "+(new Date(e.timestamp).toLocaleTimeString())}' +
    'return}' +
    'var n=RE(e);if(!n)return;mc.appendChild(n);' +
    'var atBottom=mc.scrollHeight-mc.scrollTop-mc.clientHeight<100;if(atBottom)mc.scrollTop=mc.scrollHeight}' +
    '}' +
    // Subscribe to live transcript deltas via WS (sub-second latency)
    'if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"subscribe-transcript",sessionId:x.sessionId}))}' +
    // Fallback polling (10s) in case fs.watch is unreliable on WSL/network drives
    '_pt=setInterval(FL,10000);' +
    'var w=document.getElementById("wrn");w.style.display=W(x.lastMessage)?"flex":"none";' +
    '}' +
    'function X(){_mi=-1;document.getElementById("mt").className="mt";var mcl=document.getElementById("mcl");if(mcl)mcl.style.display="block";var mv=document.getElementById("mv");if(mv)mv.style.display="none";var lx=document.getElementById("lx");if(lx)lx.style.display="";var bt=document.querySelector(".bt");if(bt)bt.style.display="";var af=document.getElementById("af");if(af)af.style.display="";document.getElementById("mip").value="";var _mct=document.getElementById("mct");_mct.style.height="";_mct.style.maxHeight="";_mct.style.borderRadius="";_mct.style.width="";_mct.style.maxWidth="";_mct.style.left="";_mct.style.right="";_mct.style.marginLeft="";' +
    'if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"unsubscribe-transcript"}))}' +
    'if(_pt){clearInterval(_pt);_pt=null}};' +

    'function KA(){if(!confirm("Kill all running sessions?"))return;for(var i=0;i<_S.length;i++){var x=_S[i];if(x.status=="running"&&x.pid){try{fetch("/api/sessions/stop' + tokSuffix + '",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:x.sessionId})})}catch(e){}}}}' +
    'function ST(){var x=_S[_mi];if(!x||!x.pid)return;' +
    'if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"stop",sessionId:x.sessionId}))}else{' +
    'fetch("/api/sessions/stop' + tokSuffix + '",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:x.sessionId})})}}' +
    'var _st={};var _stt={};' + // sent texts + confirm timers (optimistic UI dedup)
    'function SN(){var x=_S[_mi];if(!x)return;var t=document.getElementById("mip").value;if(!t)return;' +
    'var tid=Date.now()+""+Math.random().toString(36).slice(2,6);_st[tid]=t;' +
    // Optimistic: add message bubble immediately with "sending..." badge
    'var mc=document.getElementById("mcl");' +
    'var b=document.createElement("div");b.className="ch cu";b.setAttribute("data-opt",tid);' +
    'var bb=document.createElement("div");bb.className="chb";bb.textContent=t;b.appendChild(bb);' +
    'var bt=document.createElement("div");bt.className="cht";bt.textContent="sending…";var btb=bt;b.setAttribute("data-pending","1");b.appendChild(bt);' +
    'mc.appendChild(b);mc.scrollTop=mc.scrollHeight;' +
    // Confirm optimistically after 3s if no transcript confirmation arrives
    '_stt[tid]=setTimeout(function(){var el=document.querySelector(\'[data-opt="\'+tid+\'"]\');if(el){var t=el.querySelector(".cht");if(t&&t.textContent=="sending…"){t.textContent="sent";el.removeAttribute("data-pending");el.setAttribute("data-done","1")}delete _stt[tid]}},3000);' +
    'if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"send-text",sessionId:x.sessionId,text:t,submit:true}))}else{' +
    'fetch("/api/sessions/send' + tokSuffix + '",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:x.sessionId,text:t,submit:true})})}document.getElementById("mip").value="";' +
    // Auto-switch to terminal view when sending a command (starts with /)
    '}' +
    'function DP(k){var x=_S[_mi];if(!x||!x.pid)return;' +
    'var ks={ArrowUp:String.fromCharCode(27)+"[A",ArrowDown:String.fromCharCode(27)+"[B",ArrowLeft:String.fromCharCode(27)+"[D",ArrowRight:String.fromCharCode(27)+"[C",Enter:String.fromCharCode(13)};' +
    'if(k=="CtrlC"){if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"send-text",sessionId:x.sessionId,text:String.fromCharCode(3)}))}}' +
    'else{if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"send-text",sessionId:x.sessionId,text:ks[k]||k}))}}' +
    '}' +
    'function SC(){var x=_S[_mi];if(!x)return;if(navigator.platform.indexOf("Mac")>=0){alert("Screen capture: coming soon for non-macOS")}else{alert("Screen capture coming soon")}}' +
    'function PM(m){_md=m;' +
    'if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"set-mode",mode:m}))}else{' +
    'fetch("/api/settings/permission-mode' + tokSuffix + '",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:m})})}' +
    'var bs=document.querySelectorAll(".pb");for(var i=0;i<bs.length;i++){bs[i].className=bs[i].getAttribute("data-mode")==m?"pb pa":"pb"}}' +
    'function SM(m){_ml=m;' +
    'if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"set-model",model:m}))}}' +
    // ── Multiview Grid ────────────────────────────────────────────────────
    'var _gm={};function MV(){var mv=document.getElementById("mv");var lx=document.getElementById("lx");var bt=document.querySelector(".bt");var af=document.getElementById("af");if(!mv||!lx)return;if(mv.style.display=="none"){lx.style.display="none";if(bt)bt.style.display="none";if(af)af.style.display="none";mv.style.display="grid";GG();var mt=document.getElementById("mt");if(mt)mt.className="mt"}else{lx.style.display="";if(bt)bt.style.display="";if(af)af.style.display="";mv.style.display="none";document.getElementById("mt").className="mt"}}' +
    'function GG(){var mv=document.getElementById("mv");mv.textContent="";var active=_S.filter(function(s){return s.status=="running"||s.status=="waiting_input"});if(!active.length){mv.innerHTML="<div style=\\"text-align:center;padding:20px;color:#8b949e;font-size:.85em\\">No active sessions</div>";return}' +
    'for(var gi=0;gi<active.length;gi++){var s=active[gi];var sid=s.sessionId;' +
    'var p=document.createElement("div");p.className="gc";p.id="gc_"+sid;' +
    'var stc=s.status=="running"?"#3fb950":s.status=="waiting_input"?"#d29922":"#484f58";' +
    'p.innerHTML="<div class=\\"gch\\"><span class=\\"st\\" style=\\"background:"+stc+"\\"></span><span class=\\"n\\">"+E_(s.name||sid.slice(0,10))+"</span><span class=\\"mo\\">"+(s.model?E_(s.model).slice(0,20):"")+"</span></div><div class=\\"gcl\\" id=\\"gcl_"+sid+"\\"><div style=\\"text-align:center;padding:20px;color:#8b949e;font-size:.75em\\">Loading...</div></div><div class=\\"gib\\"><input class=\\"gip\\" id=\\"gip_"+sid+"\\" type=\\"text\\" enterkeyhint=\\"send\\" autocomplete=\\"off\\" placeholder=\\"Send...\\"><button class=\\"gsb\\" id=\\"gsb_"+sid+"\\">Send</button><button class=\\"gst\\" id=\\"gst_"+sid+"\\">Stop</button></div><div class=\\"gdp\\"><button data-k=\\"ArrowUp\\">\u2191</button><button data-k=\\"ArrowDown\\">\u2193</button><button data-k=\\"Enter\\">\u23ce</button><button data-k=\\"Escape\\">Esc</button><button data-k=\\"CtrlC\\">X</button></div>";' +
    'mv.appendChild(p);' +
    // Wire up send/stop/DPAD for this cell
    '(function(sid){document.getElementById("gsb_"+sid).onclick=function(){MS(sid)};' +
    'document.getElementById("gst_"+sid).onclick=function(){MST(sid)};' +
    'document.getElementById("gip_"+sid).onkeydown=function(e){if(e.key=="Enter"&&!e.ctrlKey){e.preventDefault();MS(sid)}};' +
    'var db=document.getElementById("gc_"+sid).querySelectorAll(".gdp button");for(var di=0;di<db.length;di++){db[di].onclick=function(){MDP(sid,this.getAttribute("data-k"))}}})(""+sid);' +
    // Store per-session state
    '_gm[sid]={lmc:0,lastText:""};' +
    // Load transcript
    'ML(sid)}' +
    // Subscribe to all active sessions
    'if(_W&&_W.readyState==1){for(var gi=0;gi<active.length;gi++){_W.send(JSON.stringify({type:"subscribe-transcript",sessionId:active[gi].sessionId}))}}' +
    '}' +
    'function ML(sid){fetch("/api/sessions/"+encodeURIComponent(sid)+"/full?limit=150' + (tokSuffix ? "&"+tokSuffix.slice(1) : "") + '").then(function(r){return r.json()}).then(function(d){var el=document.getElementById("gcl_"+sid);if(!el)return;var es=d.entries||[];var chat=es.filter(function(e){return e.type=="user"||e.type=="assistant"});if(chat.length==_gm[sid].lmc)return;_gm[sid].lmc=chat.length;el.textContent="";var i=0;function renderNext(){if(i>=chat.length){el.scrollTop=el.scrollHeight;return}var batch=chat.slice(i,i+20);for(var bi=0;bi<batch.length;bi++){try{var e=batch[bi];if(!e)continue;if(e.type=="user"&&e.text){var b=document.createElement("div");b.className="ch cu";var bb=document.createElement("div");bb.className="chb";bb.innerHTML=E_(e.text);b.appendChild(bb);el.appendChild(b)}else if(e.type=="assistant"){if(e.text){var b=document.createElement("div");b.className="ch ca";var bb=document.createElement("div");bb.className="chb";bb.innerHTML=E_(e.text);b.appendChild(bb);el.appendChild(b)}}}catch(e2){}}i+=20;requestAnimationFrame(renderNext)}renderNext()})}' +
    'function MS(sid){var el=document.getElementById("gip_"+sid);if(!el)return;var t=el.value;if(!t)return;' +
    'if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"send-text",sessionId:sid,text:t,submit:true}))}else{' +
    'fetch("/api/sessions/send' + tokSuffix + '",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid,text:t,submit:true})})}el.value="";' +
    'var gcl=document.getElementById("gcl_"+sid);if(gcl){var b=document.createElement("div");b.className="ch cu";var bb=document.createElement("div");bb.className="chb";bb.textContent=t;b.appendChild(bb);var bt=document.createElement("div");bt.className="cht";bt.textContent="sent";b.appendChild(bt);gcl.appendChild(b);gcl.scrollTop=gcl.scrollHeight}}' +
    'function MST(sid){if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"stop",sessionId:sid}))}}' +
    'function MDP(sid,k){var ks={ArrowUp:String.fromCharCode(27)+"[A",ArrowDown:String.fromCharCode(27)+"[B",Enter:String.fromCharCode(13)};' +
    'if(k=="CtrlC"){if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"send-text",sessionId:sid,text:String.fromCharCode(3)}))}}' +
    'else{if(_W&&_W.readyState==1){_W.send(JSON.stringify({type:"send-text",sessionId:sid,text:ks[k]||k}))}}' +
    '}' +
    'document.addEventListener("keydown",function(e){if(e.ctrlKey||e.metaKey){if(e.key==="k"){e.preventDefault();var m=document.getElementById("mcg");if(m&&m.style.display==="grid"){var lx=document.getElementById("lx");if(lx)lx.style.display="";m.style.display="none";if(typeof KA==="function"&&confirm("Kill all sessions?"))KA()}else{var mb=document.getElementById("mbd");if(mb)mb.click()}}else if(e.key==="m"){e.preventDefault();var sel=document.getElementById("ms");if(sel){sel.focus();sel.click()}}else if(e.key==="/"){e.preventDefault();var ip=document.getElementById("mip");if(ip){ip.value="/";ip.focus()}}}else if(e.key==="Escape"){if(_mi>=0){X()}}});' +
    'document.addEventListener("DOMContentLoaded",function(){' +
    'var ms=document.getElementById("ms");' +
    'for(var i=0;i<_ML.length;i++){var o=document.createElement("option");o.value=_ML[i];o.textContent=_ML[i];if(_ML[i]==_ml)o.selected=true;ms.appendChild(o)}' +
    'ms.onchange=function(){SM(this.value)};' +
    'document.getElementById("ka").onclick=KA;' +
    'document.getElementById("mbd").onclick=X;' +
    'document.getElementById("mxa").onclick=X;document.getElementById("spb").onclick=function(){MV()};' +
    'document.getElementById("stp").onclick=ST;' +
    'document.getElementById("msb").onclick=SN;' +
    'document.getElementById("scb").onclick=SC;' +
    '' +
    'document.getElementById("mip").onkeydown=function(e){if(e.key=="Enter"&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();SN()}else if((e.ctrlKey||e.metaKey)&&e.key=="Enter"){e.preventDefault();SN()}};' +
    'var chars=document.querySelectorAll(".chip");for(var ci=0;ci<chars.length;ci++){chars[ci].onclick=function(){var inp=document.getElementById("mip");if(inp){inp.value=this.getAttribute("data-cmd")+" ";inp.focus();var evt=new Event("input",{bubbles:true});inp.dispatchEvent(evt)}}};' +
    'var dbs=document.querySelectorAll(".dpb");for(var i=0;i<dbs.length;i++){dbs[i].onclick=function(){DP(this.getAttribute("data-key"))}}' +
    'var pbs=document.querySelectorAll(".pb");for(var i=0;i<pbs.length;i++){pbs[i].onclick=function(){PM(this.getAttribute("data-mode"))}}' +
    'var mct=document.getElementById("mct");var sy=0;var sd=false;var cy=0;' +
    'mct.addEventListener("touchstart",function(e){sy=e.touches[0].clientY;sd=false;cy=parseInt(mct.style.transform.replace("translateY(","").replace("px)",""))||0},false);' +
    'mct.addEventListener("touchmove",function(e){var dy=e.touches[0].clientY-sy;if(dy>0){sd=true;mct.style.transition="none";mct.style.transform="translateY("+dy+"px)"}},false);' +
    'mct.addEventListener("touchend",function(e){mct.style.transition="";mct.style.transform="";if(sd&&(e.changedTouches[0].clientY-sy)>80)X()},false);' +
    // Mobile keyboard: adjust bottom sheet when virtual keyboard opens/closes
    'if(window.visualViewport){window.visualViewport.addEventListener("resize",function(){var mct=document.getElementById("mct");if(!mct)return;var vh=window.visualViewport.height+"px";mct.style.maxHeight=vh;mct.style.height=vh})}' +
    'C()})' +
    '</script></body></html>'

// ---------------------------------------------------------------------------
// Cross-platform helpers
// ---------------------------------------------------------------------------

