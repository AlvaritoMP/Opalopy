
import React from 'react';

export const Settings: React.FC = () => {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Settings</h1>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
                <h2 className="text-xl font-semibold mb-4">Application Settings</h2>
                <p className="text-gray-600">
                    This is where application settings would be configured. 
                    For this application, the Google Generative AI API key is configured securely via environment variables and is not managed through this interface.
                </p>
                <div className="mt-6">
                    {/* Placeholder for future settings */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-base font-medium text-gray-900">Notifications</label>
                            <p className="text-sm leading-5 text-gray-500">Manage your notification preferences.</p>
                            <div className="mt-4 flex items-center space-x-4">
                                <label className="flex items-center">
                                    <input type="checkbox" className="h-4 w-4 text-primary-600 border-gray-300 rounded" defaultChecked/>
                                    <span className="ml-2 text-sm text-gray-600">Email Notifications</span>
                                </label>
                                 <label className="flex items-center">
                                    <input type="checkbox" className="h-4 w-4 text-primary-600 border-gray-300 rounded"/>
                                    <span className="ml-2 text-sm text-gray-600">Push Notifications</span>
                                </label>
                            </div>
                        </div>
                         <div>
                            <label htmlFor="theme" className="text-base font-medium text-gray-900">Theme</label>
                             <p className="text-sm leading-5 text-gray-500">Choose your preferred application theme.</p>
                             <select id="theme" className="mt-2 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md">
                                 <option>Light</option>
                                 <option>Dark</option>
                                 <option>System</option>
                             </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
