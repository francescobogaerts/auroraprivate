# Generates the AURORA Private logo set as pure-path SVGs (no font dependency).
# Mark "First Light": an A whose crossbar is the horizon, the sun rising inside it, light reflected on water.
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
ROOT=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(ROOT,'..','public','brand'); os.makedirs(OUT,exist_ok=True)
SERIF=TTFont(os.path.join(ROOT,'..','public','fonts','instrument-serif.woff2'))
SANS=TTFont(os.path.join(ROOT,'..','public','fonts','instrument-sans-var.woff2'))
INK='#1E2624'; SALT='#ECEEEA'; RED='#97555C'

def text_path(font,text,size,track_em):
    gs=font.getGlyphSet(); cmap=font.getBestCmap(); upm=font['head'].unitsPerEm; s=size/upm
    hmtx=font['hmtx']; x=0; parts=[]
    for i,ch in enumerate(text):
        g=cmap[ord(ch)]; pen=SVGPathPen(gs)
        tp=TransformPen(pen,(s,0,0,-s,x,0)); gs[g].draw(tp); parts.append(pen.getCommands())
        x+=hmtx[g][0]*s + (track_em*size if i<len(text)-1 else 0)
    return ' '.join(parts), x, font['OS/2'].sCapHeight*s

def mark(stroke, sw=1.25, x=0, y=0, k=1.0, red=None):
    t=lambda X,Y:(round(x+X*k,3),round(y+Y*k,3))
    a,b,c=t(32,4),t(8,60),t(56,60)
    h1,h2=t(2,44),t(62,44); s1,s2=t(21,44),t(43,44)
    sun=red or stroke
    r=[(49,26,38),(53,28.5,35.5),(57,30.6,33.4)]
    refl=''.join(f'<path d="M{t(x1,yy)[0]} {t(x1,yy)[1]} H{t(x2,yy)[0]}" stroke="{sun}"/>' for yy,x1,x2 in r)
    return (f'<g fill="none" stroke="{stroke}" stroke-width="{sw*k}" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M{b[0]} {b[1]} L{a[0]} {a[1]} L{c[0]} {c[1]}"/>'
            f'<path d="M{h1[0]} {h1[1]} H{h2[0]}"/>'
            f'<path d="M{s1[0]} {s1[1]} A{11*k} {11*k} 0 0 1 {s2[0]} {s2[1]}" stroke="{sun}"/>{refl}</g>')

def svg(w,h,body,title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'

WORD,ww,cap=text_path(SERIF,'AURORA',100,0.30)
SUB,sw_,scap=text_path(SANS,'PRIVATE',22,0.62)

def wordmark(col,x,y,scale=1.0,sub=True,center=False):
    # y = baseline of AURORA
    W=ww*scale; ox=x-(W/2 if center else 0)
    out=f'<path transform="translate({ox:.2f} {y:.2f}) scale({scale})" d="{WORD}" fill="{col}"/>'
    if sub:
        S=sw_*scale; sx=(x-S/2) if center else ox+(W-S)/2 if False else ox
        if center: sx=x-S/2
        out+=f'<path transform="translate({sx:.2f} {y+44*scale:.2f}) scale({scale})" d="{SUB}" fill="{col}"/>'
    return out

for name,col,mk,bg in [('ink',INK,INK,None),('salt',SALT,SALT,None),('ink-red',INK,INK,RED)]:
    sun=RED if bg else None
    # mark only
    open(f'{OUT}/aurora-mark-{name}.svg','w').write(svg(64,64,mark(col,red=sun),'AURORA Private'))
    # horizontal lockup
    k=1.6; mw=64*k; gap=36; H=128
    body=mark(col,x=0,y=14,k=k,red=sun)+wordmark(col,mw+gap,72,0.62,sub=False)+\
         f'<path transform="translate({mw+gap:.2f} {108}) scale(0.9)" d="{SUB}" fill="{col}"/>'
    open(f'{OUT}/aurora-logo-horizontal-{name}.svg','w').write(svg(mw+gap+ww*0.62+4,H,body,'AURORA Private'))
    # stacked lockup
    W=max(ww*0.7,160); cx=W/2
    body=mark(col,x=cx-64*1.9/2,y=0,k=1.9,red=sun)+wordmark(col,cx,122+62,0.7,sub=False,center=True)+\
         f'<path transform="translate({cx-sw_*1.0/2:.2f} {122+62+42}) scale(1.0)" d="{SUB}" fill="{col}"/>'
    open(f'{OUT}/aurora-logo-stacked-{name}.svg','w').write(svg(W,122+62+52,body,'AURORA Private'))
    # wordmark
    body=wordmark(col,0,cap,1.0,sub=False)
    open(f'{OUT}/aurora-wordmark-{name}.svg','w').write(svg(ww+2,cap+2,body,'AURORA'))

# currentColor header lockup used inline on the site (sun picks up --sun)
k=1.6; mw=64*k; gap=36
body=mark('currentColor',x=0,y=14,k=k,red='var(--sun,currentColor)')+wordmark('currentColor',mw+gap,72,0.62,sub=False)+f'<path transform="translate({mw+gap:.2f} 108) scale(0.9)" d="{SUB}" fill="currentColor"/>'
open(os.path.join(ROOT,'lockup-inline.svg'),'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {mw+gap+ww*0.62+4:.1f} 128" aria-hidden="true">{body}</svg>')
# favicon: mark on ink tile, sun in First Light
fav=f'<rect width="64" height="64" rx="12" fill="{INK}"/>'+mark(SALT,sw=2.2,x=6,y=5,k=0.82,red='#D8BBA6')
open(f'{OUT}/favicon.svg','w').write(svg(64,64,fav,'AURORA Private'))
# inline paths for the site header component
open(os.path.join(ROOT,'wordmark-path.txt'),'w').write(f'{ww:.2f}|{cap:.2f}|{WORD}\n{sw_:.2f}|{scap:.2f}|{SUB}')
print('word width',ww,'cap',cap,'sub',sw_)
