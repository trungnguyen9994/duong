"""Read legacy PowerPoint records and extract embedded reference bitmaps."""
import struct, pathlib, olefile
source = pathlib.Path(r'C:\Users\K_170924\Downloads\TC Giải cứu rừng xanh.ppt')
ole = olefile.OleFileIO(source)
data = ole.openstream('PowerPoint Document').read()
def records(data, depth=0):
    offset=0
    while offset+8 <= len(data):
        version, kind, length = struct.unpack_from('<HHI', data, offset)
        end = offset+8+length
        if end > len(data): break
        body=data[offset+8:end]
        if kind == 1006: print('\nSLIDE')
        if kind == 4000: print(body.decode('utf-16-le',errors='replace'))
        if kind == 4008: print(body.decode('cp1252',errors='replace'))
        if version & 15 == 15: records(body,depth+1)
        offset=end
records(data)
folder=pathlib.Path('public/art/forest-rescue');folder.mkdir(parents=True,exist_ok=True)
pictures=ole.openstream('Pictures').read()
for ext, start, stop in [('png', b'\x89PNG\r\n\x1a\n', b'IEND\xaeB`\x82'), ('jpg',b'\xff\xd8\xff',b'\xff\xd9')]:
    offset=0;number=0
    while True:
        pos=pictures.find(start,offset)
        if pos < 0: break
        end=pictures.find(stop,pos)
        if end < 0: break
        end+=len(stop); number+=1
        (folder/f'image{number}.{ext}').write_bytes(pictures[pos:end]);offset=end
print('Images:',[p.name for p in folder.iterdir()])
