'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useI18n } from '@/app/i18n';

interface TimeRecordFormProps {
  onRecordUpdate: () => void;
  currentStatus: 'checked-in' | 'checked-out' | null;
}

export default function TimeRecordForm({ onRecordUpdate, currentStatus }: TimeRecordFormProps) {
  const { t } = useI18n();
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleCheckIn = async () => {
    setIsLoading(true);
    setMessage('');
    setIsError(false);
    
    try {
      const result = await apiClient.addWorkRecordTimestamp({
        type: 'check_in',
        notes
      });
      
      if (result.error) {
        setMessage(t(`error.${result.error}`));
        setIsError(true);
      } else {
        setMessage(t('error.CheckInRegistered'));
        setNotes('');
        onRecordUpdate();
      }
    } catch (error) {
      setMessage(t('error.PostError'));
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setIsLoading(true);
    setMessage('');
    setIsError(false);
    
    try {
      const result = await apiClient.addWorkRecordTimestamp({
        type: 'check_out',
        notes
      });
      
      if (result.error) {
        setMessage(t(`error.${result.error}`));
        setIsError(true);
      } else {
        setMessage(t('error.CheckOutRegistered'));
        setNotes('');
        onRecordUpdate();
      }
    } catch (error) {
      setMessage(t('error.PostError'));
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">{t('checkin.title')}</h2>
      
      <div className="mb-4">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          {t('checkin.notesLabel')} {t('common.optional')}
        </label>
        <textarea
          id="notes"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={t('checkin.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleCheckIn}
          disabled={isLoading || currentStatus === 'checked-in'}
          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('checkin.btnIn')}
        </button>
        
        <button
          onClick={handleCheckOut}
          disabled={isLoading || currentStatus === 'checked-out'}
          className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('checkin.btnOut')}
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded-md ${
          isError 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p>{t('profile.status')}: {currentStatus ? (currentStatus === 'checked-in' ? t('profile.statusActive') : t('profile.statusInactive')) : t('checkin.notIn')}</p>
      </div>
    </div>
  );
}