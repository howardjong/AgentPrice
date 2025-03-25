import React from "react";

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  service: 'Claude' | 'Perplexity' | 'Auto-Detect' | 'System';
}

interface ApiEndpointsTableProps {
  endpoints: Endpoint[];
}

const methodColors = {
  GET: 'bg-blue-100 text-blue-800',
  POST: 'bg-green-100 text-green-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
};

export function ApiEndpointsTable({ endpoints }: ApiEndpointsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Method
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Endpoint
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Service
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {endpoints.map((endpoint, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${methodColors[endpoint.method]}`}>
                  {endpoint.method}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                {endpoint.method === 'GET' && (endpoint.path.includes('test-visualization')) ? (
                  <a 
                    href={endpoint.path} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {endpoint.path}
                  </a>
                ) : (
                  endpoint.path
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {endpoint.description}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {endpoint.service}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
