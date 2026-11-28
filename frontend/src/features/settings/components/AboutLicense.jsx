import React from 'react';
import {Info} from 'lucide-react';
import license from '../legal/LICENSE.txt?raw';
import notice from '../legal/NOTICE.txt?raw';
import terms from '../legal/ADDITIONAL_TERMS.txt?raw';
import fontNotices from '../legal/FONT_NOTICES.txt?raw';

export function AboutLicense(){
  return <div className="pp-settings-privacy">
    <Info size={20}/><div style={{minWidth:0,width:'100%'}}>
      <strong>Your APIs. Your data. Your control.</strong>
      <p>Privacy-first API client. Work locally or choose your own server. No mandatory cloud account.</p>
      <p>Our commitments: no product telemetry, behavioral tracking, usage analytics or hidden AI agents.</p>
      <p>Cloud sign-in and collaboration use network services. API requests go to their configured destinations. Operational logs and external providers have separate privacy considerations.</p>
      <p style={{overflowWrap:'anywhere'}}>Privacy documentation: https://github.com/cigetbudi/pakpost-api-client/blob/main/PRIVACY.md</p>
      <strong>Open source · GPL-3.0-only</strong>
      <p>Originally developed by cigetbudi · Copyright © 2026 cigetbudi</p>
      <p style={{overflowWrap:'anywhere'}}>Official upstream: https://github.com/cigetbudi/pakpost-api-client</p>
      <p>You may use, modify and self-host PakPost. Redistribution is subject to the GPL. This software is provided without warranty as described in the license.</p>
      <details><summary>License and attribution notices</summary>
        <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:'24rem',overflow:'auto'}}>{notice+'\n'+terms+'\n'+license+'\n\n'+fontNotices}</pre>
      </details>
    </div>
  </div>;
}
