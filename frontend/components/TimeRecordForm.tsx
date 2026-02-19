'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

interface TimeRecordFormProps {
  onRecordUpdate: () => void;
  currentStatus: 'checked-in' | 'checked-out' | null;
}

export default function TimeRecordForm({ onRecordUpdate, currentStatus }: TimeRecordFormProps) {
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCheckIn = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await apiClient.checkIn(notes);
      
      if (result.error) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage('Successfully checked in!');
        setNotes('');
        onRecordUpdate();
      }
    } catch (error) {
      setMessage('Check-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await apiClient.checkOut(notes);
      
      if (result.error) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage('Successfully checked out!');
        setNotes('');
        onRecordUpdate();
      }
    } catch (error) {
      setMessage('Check-out failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Time Record</h2>
      
      <div className="mb-4">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Add any notes about your work session..."
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
          Check In
        </button>
        
        <button
          onClick={handleCheckOut}
          disabled={isLoading || currentStatus === 'checked-out'}
          className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check Out
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded-md ${
          message.includes('Error') 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p>Current status: {currentStatus || 'Not checked in'}</p>
      </div>
    </div>
  );
}