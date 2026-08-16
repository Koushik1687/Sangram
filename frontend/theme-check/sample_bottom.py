import struct, zlib, sys, os

def read_png(path):
    data = open(path, 'rb').read()
    pos = 8
    idat = b''
    w = h = ch = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bitd, ctype, comp, filt, inter = struct.unpack('>IIBBBBB', chunk)
        elif typ == b'IDAT':
            idat += chunk
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1, 2:3, 3:1, 4:2, 6:4}[ctype]
    bpp = ch * (bitd // 8)
    stride = w * ch * (bitd // 8)
    out = bytearray()
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        ft = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if ft == 1:
            for i in range(bpp, stride): line[i] = (line[i] + line[i-bpp]) & 255
        elif ft == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif ft == 3:
            for i in range(stride):
                a = line[i-bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif ft == 4:
            for i in range(stride):
                a = line[i-bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i-bpp] if i >= bpp else 0
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out += line
        prev = line
    return w, h, ch, bytes(out)

def strip(img, w, ch, y0, y1, xstep=4):
    """Average color of a horizontal band, and left/right/center thirds."""
    h = y1 - y0
    bands = {'left': (0, w//3), 'center': (w//3, 2*w//3), 'right': (2*w//3, w)}
    for name, (x0, x1) in bands.items():
        r = g = b = n = 0
        for y in range(y0, y1):
            for x in range(x0, x1, xstep):
                i = (y * w + x) * ch
                r += img[i]; g += img[i+1]; b += img[i+2]; n += 1
        print(f"    {name:6s}: ({r//n:3d},{g//n:3d},{b//n:3d})")

for path in sys.argv[1:]:
    w, h, ch, img = read_png(path)
    print(f"== {os.path.basename(path)} ({w}x{h}) ==")
    print("  bar band (bottom 64px):")
    strip(img, w, ch, h - 64, h - 8)
    print("  home indicator (bottom 8px):")
    strip(img, w, ch, h - 8, h)
