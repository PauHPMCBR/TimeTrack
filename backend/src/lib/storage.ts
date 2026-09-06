import { promises as fs } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { AVATAR_MAX_BYTES } from 'shared/src/lib/constants';

export { AVATAR_MAX_BYTES };

// Per-company runtime data directory. In production each company's backend
// mounts its own host directory (e.g. <INFRA_DIR>/companies/<company>/data)
// at the path given by DATA_DIR, so files never live inside the container and
// survive container recreation / redeploys.
export function getDataDir(): string {
    return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

function avatarsDir(): string {
    return path.join(getDataDir(), 'avatars');
}

// Input limits. We are lenient about what users upload (any common image
// format, up to 10 MB) because sanitizeAvatar() downscales and re-encodes
// everything to a single canonical format/size below.
// Canonical output: every profile picture is stored as a 256x256 JPEG.
// JPEG (not PNG) because profile pictures are photos: much smaller files with
// negligible quality loss at this size. PNG's lossless/alpha strengths only
// matter for logos/illustrations, not headshots.
export const AVATAR_SIZE = 256;
export const AVATAR_EXT = 'jpg';
export const AVATAR_MIME = 'image/jpeg';

// Decodes any supported image (jpeg/png/webp/gif/avif/tiff/bmp/svg/...),
// crops to a centred square, flattens transparency onto white and re-encodes
// to JPEG. Throws if the buffer is not a decodable image. Because the output
// is a rasterized JPEG, embedded SVG scripts/HTML never reach the client.
//
// Note: EXIF orientation is deliberately NOT applied — auto-rotating can
// produce false rotations when a photo's EXIF tag is stale/wrong, so we keep
// the raw pixel orientation as uploaded.
export async function sanitizeAvatar(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 85 })
        .toBuffer();
}

function sanitizeFilename(filename: string): string {
    return path.basename(filename);
}

export async function readAvatar(filename: string): Promise<Buffer> {
    return fs.readFile(path.join(avatarsDir(), sanitizeFilename(filename)));
}

export async function deleteUserAvatars(userId: string): Promise<void> {
    const dir = avatarsDir();
    let entries: string[];
    try {
        entries = await fs.readdir(dir);
    } catch {
        return;
    }
    const prefix = `${userId}-`;
    await Promise.all(
        entries
            .filter((f) => f.startsWith(prefix))
            .map((f) => fs.rm(path.join(dir, f), { force: true }))
    );
}

// Saves an already-sanitized avatar for a user, removing any previous one, and
// returns the filename (unique per upload so browsers can cache it immutably).
export async function saveAvatar(
    userId: string,
    image: Buffer
): Promise<string> {
    const dir = avatarsDir();
    await fs.mkdir(dir, { recursive: true });
    await deleteUserAvatars(userId);
    const filename = `${userId}-${Date.now()}.${AVATAR_EXT}`;
    await fs.writeFile(path.join(dir, filename), image);
    return filename;
}

// --- Admin-shared employee files (payrolls, etc.) ----------------------------

function documentsDir(): string {
    return path.join(getDataDir(), 'documents');
}

// Saves a document and returns the generated filename. The name is
// server-generated (owner id + timestamp + random suffix) so same-named or
// repeated uploads never collide; the employee-facing name is kept in the DB.
export async function saveDocument(
    userId: string,
    data: Buffer
): Promise<string> {
    const dir = documentsDir();
    await fs.mkdir(dir, { recursive: true });
    const filename = `${userId}-${Date.now()}-${randomBytes(6).toString('hex')}`;
    await fs.writeFile(path.join(dir, filename), data);
    return filename;
}

export async function readDocument(filename: string): Promise<Buffer> {
    return fs.readFile(path.join(documentsDir(), sanitizeFilename(filename)));
}

export async function deleteDocument(filename: string): Promise<void> {
    await fs.rm(path.join(documentsDir(), sanitizeFilename(filename)), {
        force: true,
    });
}
