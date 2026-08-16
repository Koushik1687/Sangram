import struct, zlib, sys, os

def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a png'
    pos = 8
    idat = b''
    w = h = bitd = ctype = None
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

def px(img, w, ch, x, y):
    i = (y * w + x) * ch
    return tuple(img[i:i+3])

def avg_region(img, w, h, ch, x0, y0, x1, y1):
    r = g = b = n = 0
    for y in range(y0, y1, max(1, (y1-y0)//40)):
        for x in range(x0, x1, max(1, (x1-x0)//40)):
            rr, gg, bb = px(img, w, ch, x, y)
            r += rr; g += gg; b += bb; n += 1
    return (r//n, g//n, b//n)

for path in sys.argv[1:]:
    w, h, ch, img = read_png(path)
    print(f"\n== {os.path.basename(path)}  ({w}x{h}) ==")
    print(f"  page bg top-left : {avg_region(img,w,h,ch, 20, 20, w//4, 80)}")
    print(f"  page bg right    : {avg_region(img,w,h,ch, w-80, h//2, w-20, h//2+40)}")
    print(f"  bottom nav area  : {avg_region(img,w,h,ch, w//4, h-60, 3*w//4, h-20)}")
    print(f"  mid content      : {avg_region(img,w,h,ch, w//3, h//2, 2*w//3, h//2+40)}")
