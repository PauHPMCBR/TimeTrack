'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/app/i18n';

function translatedOr(
    t: (key: string) => string,
    key: string,
    fallback: string
): string {
    const value = t(key);
    return value !== key ? value : fallback;
}

export function useApiNotifications() {
    const { showNotification } = useNotifications();
    const { t } = useI18n();

    useEffect(() => {
        apiClient.setErrorListener((error, details) => {
            const detailsObj = (details ?? {}) as {
                incorrectParameter?: string;
                reasons?: string[];
                illegalAction?: string;
            };

            // Some error codes map to an object in the locale files (e.g.
            // `error.IllegalAction.*`); `t()` then returns the key itself, so
            // fall back to the specific sub-translation from `details`.
            let message = t(`error.${error}`);

            if (message === `error.${error}`) {
                if (error === 'IllegalAction' && detailsObj.illegalAction) {
                    message = translatedOr(
                        t,
                        `error.IllegalAction.${detailsObj.illegalAction}`,
                        error
                    );
                } else if (error === 'IncorrectParameter') {
                    const reasons = detailsObj.reasons ?? [];
                    const reasonMsgs = reasons
                        .map((reason) => {
                            const key = `error.IncorrectParameter.reason.${reason}`;
                            return t(key) !== key ? t(key) : null;
                        })
                        .filter(Boolean) as string[];
                    if (reasonMsgs.length > 0) {
                        message = reasonMsgs.join(', ');
                    } else if (detailsObj.incorrectParameter) {
                        const label = translatedOr(
                            t,
                            `error.IncorrectParameter.${detailsObj.incorrectParameter}`,
                            detailsObj.incorrectParameter
                        );
                        message = `${t('error.IncorrectParameter.message')} (${label})`;
                    } else {
                        message = error;
                    }
                } else {
                    message = error;
                }
            }

            showNotification({
                type: 'error',
                message: message,
            });
        });

        return () => {
            apiClient.setErrorListener(null);
        };
    }, [showNotification, t]);
}
