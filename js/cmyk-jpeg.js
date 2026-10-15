/*
  CMYK JPEG encoder — לקובץ "חיתוך צורני" (D-77) בבית דפוס שדורש CMYK.

  מבוסס על מקודד ה-JPEG של jpeg-js (Andreas Ritter, 2009), שמבוסס על as3corelib:
  Copyright (c) 2008, Adobe Systems Incorporated. All rights reserved.
  Redistribution and use in source and binary forms, with or without modification,
  are permitted provided that the following conditions are met:
  * Redistributions of source code must retain the above copyright notice, this list
    of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice, this
    list of conditions and the following disclaimer in the documentation and/or other
    materials provided with the distribution.
  * Neither the name of Adobe Systems Incorporated nor the names of its contributors
    may be used to endorse or promote products derived from this software without
    specific prior written permission.
  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
  EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
  CONTRIBUTORS BE LIABLE FOR ANY DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE.

  מה שונה מהמקור:
  • 4 רכיבים (C,M,Y,K) בלי תת-דגימה, כולם עם טבלאות ה-luminance. בלי JFIF (JFIF = YCbCr בלבד).
  • ⛔ הערכים נשמרים הפוכים (255 = אין דיו), עם סמן Adobe APP14 transform=0 — המוסכמה של
    Photoshop. jsPDF מוסיף לכל תמונת CMYK את /Decode [1 0 1 0 1 0 1 0] (jspdf 2.5.1, putImage),
    כלומר הוא מניח את המוסכמה הזו. ערכים לא-הפוכים יוצאים בתשליל.
  • המרת RGB→CMYK נאיבית (בלי פרופיל ICC): K=1-max(R,G,B), והשאר ביחס ל-(1-K).
    שחור יוצא 100% K בלבד; סך הדיו המרבי ~280% (מתחת ל-300% המקובל).
*/
(function(){
'use strict';
const ZigZag=[0,1,5,6,14,15,27,28,2,4,7,13,16,26,29,42,3,8,12,17,25,30,41,43,9,11,18,24,31,40,44,53,
  10,19,23,32,39,45,52,54,20,22,33,38,46,51,55,60,21,34,37,47,50,56,59,61,35,36,48,49,57,58,62,63];
const DC_NR=[0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0];
const DC_VAL=[0,1,2,3,4,5,6,7,8,9,10,11];
const AC_NR=[0,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d];
const AC_VAL=[0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,
  0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,
  0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,
  0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
  0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,
  0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
  0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,
  0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,
  0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,
  0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa];
const QT=[16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,
  14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,
  49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];
const AASF=[1.0,1.387039845,1.306562965,1.175875602,1.0,0.785694958,0.541196100,0.275899379];

function huff(nr,vals){
  const HT=[];let code=0,p=0;
  for(let k=1;k<=16;k++){for(let j=1;j<=nr[k];j++){HT[vals[p++]]=[code,k];code++;}code*=2;}
  return HT;
}
const DC_HT=huff(DC_NR,DC_VAL), AC_HT=huff(AC_NR,AC_VAL);
const category=new Int32Array(65535), bitcode=new Array(65535);
(function(){
  let lo=1,hi=2;
  for(let cat=1;cat<=15;cat++){
    for(let nr=lo;nr<hi;nr++){category[32767+nr]=cat;bitcode[32767+nr]=[nr,cat];}
    for(let nr=-(hi-1);nr<=-lo;nr++){category[32767+nr]=cat;bitcode[32767+nr]=[hi-1+nr,cat];}
    lo<<=1;hi<<=1;
  }
})();

function tables(quality){
  quality=Math.max(1,Math.min(100,quality|0));
  const sf=quality<50?Math.floor(5000/quality):Math.floor(200-quality*2);
  const Q=new Array(64),fd=new Float64Array(64);
  for(let i=0;i<64;i++){Q[ZigZag[i]]=Math.min(255,Math.max(1,Math.floor((QT[i]*sf+50)/100)));}
  let k=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){fd[k]=1/(Q[ZigZag[k]]*AASF[r]*AASF[c]*8);k++;}
  return{Q,fd};
}

function encode(imgData,quality){
  const W=imgData.width,H=imgData.height,px=imgData.data;
  const{Q,fd}=tables(quality==null?92:quality);
  let out=new Uint8Array(Math.max(1<<16,W*H)),len=0;
  const byte=v=>{if(len>=out.length){const n=new Uint8Array(out.length*2);n.set(out);out=n;}out[len++]=v;};
  const word=v=>{byte((v>>8)&255);byte(v&255);};
  let bnew=0,bpos=7;
  const bits=bs=>{
    const val=bs[0];let p=bs[1]-1;
    while(p>=0){
      if(val&(1<<p))bnew|=(1<<bpos);
      p--;bpos--;
      if(bpos<0){if(bnew===255){byte(255);byte(0);}else byte(bnew);bpos=7;bnew=0;}
    }
  };
  // ── headers ──
  word(0xFFD8);
  // Adobe APP14: version 100, flags 0/0, transform 0 (CMYK בלי המרת צבע)
  word(0xFFEE);word(14);[0x41,0x64,0x6F,0x62,0x65].forEach(byte);word(100);word(0);word(0);byte(0);
  word(0xFFDB);word(67);byte(0);for(let i=0;i<64;i++)byte(Q[i]);
  word(0xFFC0);word(8+3*4);byte(8);word(H);word(W);byte(4);
  for(let c=1;c<=4;c++){byte(c);byte(0x11);byte(0);}
  word(0xFFC4);word(2+17+12+17+162);
  byte(0);for(let i=0;i<16;i++)byte(DC_NR[i+1]);for(let i=0;i<12;i++)byte(DC_VAL[i]);
  byte(0x10);for(let i=0;i<16;i++)byte(AC_NR[i+1]);for(let i=0;i<162;i++)byte(AC_VAL[i]);
  word(0xFFDA);word(6+2*4);byte(4);for(let c=1;c<=4;c++){byte(c);byte(0);}byte(0);byte(0x3f);byte(0);

  // ── המרה ל-CMYK הפוך (Adobe) — פעם אחת לכל פיקסל ──
  const N=W*H,cmyk=new Uint8Array(N*4);
  for(let i=0,j=0;i<N;i++,j+=4){
    const a=px[j+3]/255;                         // שקיפות → מעל לבן (צבע הנייר)
    const r=(px[j]*a+255*(1-a))/255,g=(px[j+1]*a+255*(1-a))/255,b=(px[j+2]*a+255*(1-a))/255;
    const k=1-Math.max(r,g,b);
    let c=0,m=0,y=0;
    if(k<1){const d=1-k;c=(1-r-k)/d;m=(1-g-k)/d;y=(1-b-k)/d;}
    cmyk[j]=255-Math.round(c*255);cmyk[j+1]=255-Math.round(m*255);
    cmyk[j+2]=255-Math.round(y*255);cmyk[j+3]=255-Math.round(k*255);
  }

  const data=new Float64Array(64),q=new Int32Array(64),DU=new Int32Array(64);
  const fdct=()=>{
    for(let o=0;o<64;o+=8){
      const t0=data[o]+data[o+7],t7=data[o]-data[o+7],t1=data[o+1]+data[o+6],t6=data[o+1]-data[o+6];
      const t2=data[o+2]+data[o+5],t5=data[o+2]-data[o+5],t3=data[o+3]+data[o+4],t4=data[o+3]-data[o+4];
      let a10=t0+t3,a13=t0-t3,a11=t1+t2,a12=t1-t2;
      data[o]=a10+a11;data[o+4]=a10-a11;
      const z1=(a12+a13)*0.707106781;data[o+2]=a13+z1;data[o+6]=a13-z1;
      a10=t4+t5;a11=t5+t6;a12=t6+t7;
      const z5=(a10-a12)*0.382683433,z2=0.541196100*a10+z5,z4=1.306562965*a12+z5,z3=a11*0.707106781;
      const z11=t7+z3,z13=t7-z3;
      data[o+5]=z13+z2;data[o+3]=z13-z2;data[o+1]=z11+z4;data[o+7]=z11-z4;
    }
    for(let o=0;o<8;o++){
      const t0=data[o]+data[o+56],t7=data[o]-data[o+56],t1=data[o+8]+data[o+48],t6=data[o+8]-data[o+48];
      const t2=data[o+16]+data[o+40],t5=data[o+16]-data[o+40],t3=data[o+24]+data[o+32],t4=data[o+24]-data[o+32];
      let a10=t0+t3,a13=t0-t3,a11=t1+t2,a12=t1-t2;
      data[o]=a10+a11;data[o+32]=a10-a11;
      const z1=(a12+a13)*0.707106781;data[o+16]=a13+z1;data[o+48]=a13-z1;
      a10=t4+t5;a11=t5+t6;a12=t6+t7;
      const z5=(a10-a12)*0.382683433,z2=0.541196100*a10+z5,z4=1.306562965*a12+z5,z3=a11*0.707106781;
      const z11=t7+z3,z13=t7-z3;
      data[o+40]=z13+z2;data[o+24]=z13-z2;data[o+8]=z11+z4;data[o+56]=z11-z4;
    }
    for(let i=0;i<64;i++){const v=data[i]*fd[i];q[i]=v>0?((v+0.5)|0):((v-0.5)|0);}
  };
  const EOB=AC_HT[0],M16=AC_HT[0xF0];
  const block=DC=>{
    fdct();
    for(let j=0;j<64;j++)DU[ZigZag[j]]=q[j];
    const diff=DU[0]-DC;DC=DU[0];
    if(diff===0)bits(DC_HT[0]);else{const p=32767+diff;bits(DC_HT[category[p]]);bits(bitcode[p]);}
    let end=63;while(end>0&&DU[end]===0)end--;
    if(end===0){bits(EOB);return DC;}
    let i=1;
    while(i<=end){
      const st=i;while(DU[i]===0&&i<=end)i++;
      let nz=i-st;
      if(nz>=16){for(let n=1;n<=(nz>>4);n++)bits(M16);nz&=0xF;}
      const p=32767+DU[i];bits(AC_HT[(nz<<4)+category[p]]);bits(bitcode[p]);i++;
    }
    if(end!==63)bits(EOB);
    return DC;
  };
  const DC=[0,0,0,0];
  for(let y=0;y<H;y+=8){
    for(let x=0;x<W;x+=8){
      for(let ch=0;ch<4;ch++){
        for(let pos=0;pos<64;pos++){
          const yy=Math.min(H-1,y+(pos>>3)),xx=Math.min(W-1,x+(pos&7));   // ריפוד = שכפול הקצה
          data[pos]=cmyk[(yy*W+xx)*4+ch]-128;
        }
        DC[ch]=block(DC[ch]);
      }
    }
  }
  if(bpos>=0)bits([(1<<(bpos+1))-1,bpos+1]);
  word(0xFFD9);
  return out.slice(0,len);
}

// canvas → JPEG CMYK (Uint8Array), מוכן ל-pdf.addImage(bytes,'JPEG',…)
function fromCanvas(canvas,quality){
  const ctx=canvas.getContext('2d');
  return encode(ctx.getImageData(0,0,canvas.width,canvas.height),quality);
}
const api={encode,fromCanvas};
if(typeof window!=='undefined')window.cmykJpeg=api;
if(typeof module!=='undefined')module.exports=api;
})();
