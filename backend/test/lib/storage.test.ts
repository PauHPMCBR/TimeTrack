import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import sharp from 'sharp';
import {
    sanitizeAvatar,
    AVATAR_SIZE,
    AVATAR_EXT,
    saveAvatar,
    readAvatar,
    deleteUserAvatars,
} from '@/lib/storage';

describe('storage', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(tmpdir(), 'timetrack-storage-'));
        process.env.DATA_DIR = dir;
    });

    afterEach(async () => {
        delete process.env.DATA_DIR;
        await fs.rm(dir, { recursive: true, force: true });
    });

    describe('sanitizeAvatar', () => {
        it('normalizes any image to a square JPEG of canonical size', async () => {
            const jpeg = await sharp({
                create: {
                    width: 400,
                    height: 300,
                    channels: 3,
                    background: { r: 10, g: 20, b: 30 },
                },
            })
                .jpeg()
                .toBuffer();
            const gif = await sharp({
                create: {
                    width: 120,
                    height: 80,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                },
            })
                .gif()
                .toBuffer();

            for (const input of [jpeg, gif]) {
                const output = await sanitizeAvatar(input);
                const meta = await sharp(output).metadata();
                expect(meta.format).toBe('jpeg');
                expect(meta.width).toBe(AVATAR_SIZE);
                expect(meta.height).toBe(AVATAR_SIZE);
            }
        });

        it('rejects data that is not an image', async () => {
            await expect(
                sanitizeAvatar(Buffer.from('<svg onload=alert(1)>'))
            ).rejects.toThrow();
            await expect(
                sanitizeAvatar(Buffer.from('definitely not an image'))
            ).rejects.toThrow();
        });
    });

    describe('saveAvatar / readAvatar / deleteUserAvatars', () => {
        it('saves, reads and replaces avatars for a user', async () => {
            const first = await saveAvatar('user-1', Buffer.from('first'));
            expect(first.endsWith(`.${AVATAR_EXT}`)).toBe(true);
            expect(await readAvatar(first)).toEqual(Buffer.from('first'));

            const second = await saveAvatar('user-1', Buffer.from('second'));
            expect(await readAvatar(second)).toEqual(Buffer.from('second'));

            const files = await fs.readdir(path.join(dir, 'avatars'));
            expect(files).toEqual([second]); // old file removed

            await deleteUserAvatars('user-1');
            const remaining = await fs.readdir(path.join(dir, 'avatars'));
            expect(remaining).toEqual([]);
        });

        it('ignores other users when deleting', async () => {
            await saveAvatar('user-1', Buffer.from('one'));
            const other = await saveAvatar('user-2', Buffer.from('two'));

            await deleteUserAvatars('user-1');
            expect(await readAvatar(other)).toEqual(Buffer.from('two'));
        });

        it('does not traverse paths via filename', async () => {
            await expect(readAvatar('../../etc/passwd')).rejects.toThrow();
        });
    });
});
