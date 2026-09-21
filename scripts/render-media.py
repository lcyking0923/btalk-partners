"""Render the image-based silent website films from the supplied concept assets."""
from pathlib import Path
import concurrent.futures
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.sites-runtime' / 'media-python'))
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
ASSETS = ROOT / 'dist' / 'assets'
WORK = ROOT / '.sites-runtime' / 'media-render'
WORK.mkdir(parents=True, exist_ok=True)
FONT = WORK / 'typeface.ttf'
if not FONT.exists():
    shutil.copyfile('C:/Windows/Fonts/malgun.ttf', FONT)
FONT_FILTER = '.sites-runtime/media-render/typeface.ttf'

def run(args):
    command = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-filter_threads', '2'] + args
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])

def encode_args(target):
    return ['-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(target)]

def hero():
    filters = "scale=2560:-1,crop=2560:1440,zoompan=z='1.015+0.025*(1-cos(2*PI*on/360))/2':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=360:s=1280x720:fps=30,setsar=1,format=yuv420p"
    run(['-i', str(ASSETS / 'connection-bridge.png'), '-vf', filters, '-frames:v', '360'] + encode_args(ASSETS / 'connection-loop.mp4'))
    print('Hero film ready: 12 seconds', flush=True)

SCENES = [
    ('medical-technology', 'MEDICAL DEVICES', '의료 현장과 기술을 연결합니다.'),
    ('global-healthcare', 'GLOBAL HEALTHCARE', '국경을 넘어 사람과 의료를 잇습니다.'),
    ('marketing-strategy', 'INTEGRATED MARKETING', '브랜드의 가치를 시장에 전합니다.'),
    ('content-production', 'CREATIVE CONTENTS', '기억되는 이야기를 만듭니다.'),
]

def scene(entry):
    key, title, subtitle = entry
    filters = (
        "scale=2560:-1,crop=2560:1440,zoompan=z='1.01+0.055*on/180':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=180:s=1280x720:fps=30,setsar=1,format=yuv420p,"
        "drawbox=x=0:y=486:w=iw:h=234:color=0x0a2039@0.78:t=fill,"
        f"drawtext=fontfile='{FONT_FILTER}':text='BTalk Partners':fontsize=19:fontcolor=0xb8cde5:x=56:y=517,"
        f"drawtext=fontfile='{FONT_FILTER}':text='{title}':fontsize=39:fontcolor=white:x=54:y=555,"
        f"drawtext=fontfile='{FONT_FILTER}':text='{subtitle}':fontsize=23:fontcolor=0xdce7f3:x=56:y=616"
    )
    destination = WORK / f'{key}.mp4'
    run(['-i', str(ASSETS / f'{key}.webp'), '-vf', filters, '-frames:v', '180'] + encode_args(destination))
    print(f'Scene ready: {key}', flush=True)
    return destination

def film():
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        scenes = list(pool.map(scene, SCENES))
    inputs = [part for scene_path in scenes for part in ['-i', str(scene_path)]]
    graph = (
        '[0:v][1:v]xfade=transition=fade:duration=0.8:offset=5.2[a];'
        '[a][2:v]xfade=transition=fade:duration=0.8:offset=10.4[b];'
        '[b][3:v]xfade=transition=fade:duration=0.8:offset=15.6,'
        'fade=t=in:st=0:d=0.4,fade=t=out:st=21.1:d=0.5,format=yuv420p[out]'
    )
    run(inputs + ['-filter_complex_threads', '2', '-filter_complex', graph, '-map', '[out]', '-r', '30'] + encode_args(ASSETS / 'btalk-brand-film.mp4'))
    print('Brand film ready: 21.6 seconds', flush=True)

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if mode in ('all', 'hero'):
        hero()
    if mode in ('all', 'film'):
        film()
