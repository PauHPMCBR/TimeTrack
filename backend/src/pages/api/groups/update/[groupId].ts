import mongoose from 'mongoose';
import { withApi } from '@/lib/api-handler';
import { Group, User } from '@/models';
import { notDeleted, countActiveByIds } from '@/repositories/user-repository';
import { runInTransaction } from '@/lib/transaction';
import {
    responseErrorDelete,
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import {
    GroupIdParamSchema,
    CreateGroupRequestSchema,
} from 'shared/src/schemas/api';
import type { NextApiRequest, NextApiResponse } from 'next';

const putHandler = withApi(
    {
        method: 'PUT',
        guard: 'admin',
        query: GroupIdParamSchema,
        body: CreateGroupRequestSchema,
    },
    async (_req, res, { query, body }) => {
        try {
            const groupId = query.groupId;
            const { name, description, members } = body;

            const groupObjectId = new mongoose.Types.ObjectId(groupId);
            const group = await Group.findById(groupObjectId);

            if (!group) {
                return responseErrorEntryNotFound(res, 'Group');
            }

            if (members && members.length > 0) {
                const validMemberIds = members.filter((m: string) =>
                    mongoose.Types.ObjectId.isValid(m)
                );

                const usersExist = await countActiveByIds(validMemberIds);

                if (usersExist !== validMemberIds.length) {
                    return responseErrorIncorrectParameter(res, 'members', [
                        'SomeUsersNotFound',
                    ]);
                }
            }

            // Group update + membership rewiring must be atomic: a failure between
            // the $pull and $addToSet would otherwise leave users orphaned.
            const updatedGroup = await runInTransaction(async (session) => {
                const groupOptions = session ? { session } : undefined;
                await Group.findByIdAndUpdate(
                    groupObjectId,
                    { name, description, members },
                    { new: true, ...groupOptions }
                );

                await User.updateMany(
                    { groups: groupObjectId },
                    { $pull: { groups: groupObjectId } },
                    groupOptions
                );

                if (members && members.length > 0) {
                    await User.updateMany(
                        { _id: { $in: members }, ...notDeleted },
                        { $addToSet: { groups: groupObjectId } },
                        groupOptions
                    );
                }

                return Group.findById(groupObjectId);
            });

            res.status(200).json({
                success: true,
                data: { group: updatedGroup },
            });
        } catch (error) {
            console.error('Update group error:', error);
            return responseErrorPut(res);
        }
    }
);

const deleteHandler = withApi(
    { method: 'DELETE', guard: 'admin', query: GroupIdParamSchema },
    async (_req, res, { query }) => {
        try {
            const groupId = query.groupId;

            await runInTransaction(async (session) => {
                const groupOptions = session ? { session } : undefined;
                const deleted = await Group.findByIdAndDelete(
                    groupId,
                    groupOptions
                );
                if (!deleted) {
                    throw new Error('GroupNotFound');
                }
                await User.updateMany(
                    { groups: new mongoose.Types.ObjectId(groupId) },
                    { $pull: { groups: new mongoose.Types.ObjectId(groupId) } },
                    groupOptions
                );
            });

            res.status(200).json({
                success: true,
                data: { message: 'GroupDeleted' },
            });
        } catch (error) {
            if ((error as Error).message === 'GroupNotFound') {
                return responseErrorEntryNotFound(res, 'Group');
            }
            console.error('Delete group error:', error);
            return responseErrorDelete(res);
        }
    }
);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') return putHandler(req, res);
    if (req.method === 'DELETE') return deleteHandler(req, res);
    return responseErrorMethodNotAllowed(res);
}
