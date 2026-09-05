import type { NextApiResponse } from 'next';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { Group, User } from '@/models';
import { runInTransaction } from '@/lib/transaction';
import {
    responseErrorDelete,
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import {
    runValidation,
    validateQueryParams,
    validateRequestBody,
} from '@/lib/validation';
import {
    GroupIdParamSchema,
    CreateGroupRequestSchema,
} from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (
        !(await runValidation(
            validateQueryParams(GroupIdParamSchema),
            req,
            res
        ))
    )
        return;

    if (req.method === 'PUT') {
        if (
            !(await runValidation(
                validateRequestBody(CreateGroupRequestSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const groupId = req.query.groupId as string;
            const { name, description, members } = req.body;

            const groupObjectId = new mongoose.Types.ObjectId(groupId);
            const group = await Group.findById(groupObjectId);

            if (!group) {
                return responseErrorEntryNotFound(res, 'Group');
            }

            if (members && members.length > 0) {
                const validMemberIds = members.filter((m: string) =>
                    mongoose.Types.ObjectId.isValid(m)
                );

                const usersExist = await User.countDocuments({
                    _id: { $in: validMemberIds },
                    deleted: { $ne: true },
                });

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
                        { _id: { $in: members }, deleted: { $ne: true } },
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
    } else if (req.method === 'DELETE') {
        try {
            await dbConnect();
            const groupId = req.query.groupId as string;

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
    } else {
        return responseErrorMethodNotAllowed(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
