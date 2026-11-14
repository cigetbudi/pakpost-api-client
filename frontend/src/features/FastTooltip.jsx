import React, {useEffect,useState} from 'react';

export function FastTooltip() {
  const [tip,setTip] = useState(null);
  useEffect(()=>{
    let current = null;
    function display(event) {
      const element = event.target instanceof Element ? event.target.closest('[title],[data-pp-tip]') : null;
      if (!element || !element.closest('.pp-app')) return;
      const label = element.getAttribute('title') || element.dataset.ppTip;
      if (!label) return;
      // Remove the browser-native title: native tooltip waits roughly a second.
      if (element.hasAttribute('title')) {
        element.dataset.ppTip = label;
        if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) element.setAttribute('aria-label',label);
        element.removeAttribute('title');
      }
      if (current === element) return;
      current=element;
      const box=element.getBoundingClientRect();
      const left=Math.max(8,Math.min(window.innerWidth-240,box.left+box.width/2-90));
      const above=box.top > 45;
      setTip({label,left,top:above?box.top-8:box.bottom+8,above});
    }
    function hide(event) {
      if (!current) return;
      if(event?.relatedTarget instanceof Node && current.contains(event.relatedTarget))return;
      current=null;setTip(null);
    }
    function onScroll(){current=null;setTip(null);}
    document.addEventListener('pointerover',display,true);
    document.addEventListener('pointerout',hide,true);
    document.addEventListener('focusin',display,true);
    document.addEventListener('focusout',hide,true);
    document.addEventListener('pointerdown',onScroll,true);
    window.addEventListener('scroll',onScroll,true);
    return ()=>{
      document.removeEventListener('pointerover',display,true);
      document.removeEventListener('pointerout',hide,true);
      document.removeEventListener('focusin',display,true);
      document.removeEventListener('focusout',hide,true);
      document.removeEventListener('pointerdown',onScroll,true);
      window.removeEventListener('scroll',onScroll,true);
    };
  },[]);
  return tip && <div role="tooltip" className={`pp-fast-tooltip ${tip.above?'above':'below'}`} style={{left:tip.left,top:tip.top}}>{tip.label}</div>;
}
