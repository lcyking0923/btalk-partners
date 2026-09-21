"""Render silent films with subpixel camera motion from the original concept images."""
from pathlib import Path
import concurrent.futures
import math
import shutil
import subprocess
import sys

from PIL import Image

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
FPS = 60
SCENE_SECONDS = 7
DISSOLVE_SECONDS = 1
FILM_SECONDS = SCENE_SECONDS * 4 - DISSOLVE_SECONDS * 3


def run(args):
    command = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-filter_threads', '2'] + args
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])


def encode_args(target, intermediate=False):
    return ['-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast',
            '-crf', '16' if intermediate else '21', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', str(target)]


def ease(progress):
    return (1 - math.cos(math.pi * progress)) / 2


def camera_film(source, target, size, seconds, motion, intermediate=False):
    """Resample fractional crop boxes in RGB; never snap slow motion to whole pixels."""
    with Image.open(source) as opened:
        original = opened.convert('RGB')
    width, height = size
    crop_width = min(original.width, original.height * width / height)
    crop_height = crop_width * height / width
    frames = round(seconds * FPS)
    command = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y',
               '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s:v', f'{width}x{height}',
               '-r', str(FPS), '-i', 'pipe:0', '-vf', 'setsar=1',
               *encode_args(target, intermediate)]
    error_path = WORK / f'{target.stem}.log'
    with error_path.open('w+b') as error_log:
        process = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.PIPE, stderr=error_log)
        try:
            for frame_index in range(frames):
                zoom, anchor_x, anchor_y = motion(frame_index, frames)
                box_width, box_height = crop_width / zoom, crop_height / zoom
                left = (original.width - box_width) * anchor_x
                top = (original.height - box_height) * anchor_y
                frame = original.resize(size, Image.Resampling.LANCZOS,
                                        box=(left, top, left + box_width, top + box_height))
                process.stdin.write(frame.tobytes())
            process.stdin.close()
            if process.wait():
                error_log.seek(0)
                raise RuntimeError(error_log.read().decode('utf-8', errors='replace')[-5000:])
        except BaseException:
            process.kill()
            process.wait()
            raise


def poster(video, destination):
    run(['-i', str(video), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '92', str(destination)])


def hero():
    target = WORK / 'connection-loop.mp4'

    def motion(index, frames):
        # Match position and speed across the loop boundary.
        phase = 2 * math.pi * index / frames
        return 1 + .012 * (1 - math.cos(phase)) / 2, .5, .5

    # Keep the source aspect ratio so mobile cover-cropping stays stable as well.
    camera_film(ASSETS / 'connection-bridge.png', target, (1440, 960), 18, motion)
    poster(target, ASSETS / 'connection-poster.webp')
    shutil.copyfile(target, ASSETS / target.name)
    print('Hero film ready: 18 seconds, 60 fps, seamless 1.2% motion', flush=True)


SCENES = [
    ('medical-technology', 'MEDICAL DEVICES', '의료 현장과 기술을 연결합니다.'),
    ('global-healthcare', 'GLOBAL HEALTHCARE', '국경을 넘어 사람과 의료를 잇습니다.'),
    ('marketing-strategy', 'INTEGRATED MARKETING', '브랜드의 가치를 시장에 전합니다.'),
    ('content-production', 'CREATIVE CONTENTS', '기억되는 이야기를 만듭니다.'),
]


def scene(index):
    key = SCENES[index][0]
    destination = WORK / f'{key}.mp4'

    def motion(frame_index, frames):
        progress = ease(frame_index / (frames - 1))
        # Especially restrained around faces; alternate push-in and pull-back shots.
        amount = (.020, .012, .018, .020)[index]
        zoom = 1.006 + amount * (progress if index % 2 == 0 else 1 - progress)
        return zoom, .5, .5

    camera_film(ASSETS / f'{key}.webp', destination, (1280, 720),
                SCENE_SECONDS, motion, intermediate=True)
    print(f'Scene ready: {key}', flush=True)
    return destination


def film():
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        scenes = list(pool.map(scene, range(len(SCENES))))
    inputs = [part for scene_path in scenes for part in ['-i', str(scene_path)]]
    graph = (
        '[0:v][1:v]xfade=transition=fade:duration=1:offset=6[a];'
        '[a][2:v]xfade=transition=fade:duration=1:offset=12[b];'
        '[b][3:v]xfade=transition=fade:duration=1:offset=18,'
        'drawbox=x=0:y=486:w=iw:h=234:color=0x0a2039@0.78:t=fill,'
        f"drawtext=fontfile='{FONT_FILTER}':text='BTalk Partners':fontsize=19:fontcolor=0xb8cde5:x=56:y=517"
    )
    # Composite typography after dissolves, with no overlap between changing titles.
    for index, (_, title, subtitle) in enumerate(SCENES):
        start = 0 if index == 0 else index * 6 + .7
        end = FILM_SECONDS if index == 3 else (index + 1) * 6 + .25
        alpha_in = '1' if index == 0 else f'min(1,max(0,(t-{start})/0.5))'
        alpha_out = '1' if index == 3 else f'min(1,max(0,({end}-t)/0.5))'
        alpha = f'{alpha_in}*{alpha_out}'
        graph += (
            f",drawtext=fontfile='{FONT_FILTER}':text='{title}':fontsize=39:fontcolor=white:x=54:y=555:alpha='{alpha}'"
            f",drawtext=fontfile='{FONT_FILTER}':text='{subtitle}':fontsize=23:fontcolor=0xdce7f3:x=56:y=616:alpha='{alpha}'"
        )
    graph += ',format=yuv420p[out]'
    target = WORK / 'btalk-brand-film.mp4'
    run(inputs + ['-filter_complex_threads', '2', '-filter_complex', graph,
                  '-map', '[out]', '-r', str(FPS)] + encode_args(target))
    # Match the poster to the actual opening frame and hold the final image.
    poster(target, ASSETS / 'brand-film-poster.webp')
    shutil.copyfile(target, ASSETS / target.name)
    print(f'Brand film ready: {FILM_SECONDS} seconds, 60 fps, separate title transitions', flush=True)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if mode in ('all', 'hero'):
        hero()
    if mode in ('all', 'film'):
        film()
