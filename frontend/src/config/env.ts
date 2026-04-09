const fallbackApiUrl = "http://localhost:4000";

export const env = {
  apiUrl: import.meta.env.VITE_API_URL || fallbackApiUrl,
};
