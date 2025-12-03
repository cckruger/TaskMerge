import { Account, Task, Tag } from "../types";

const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const FILENAME = "taskmerge_data.json";

export interface AppData {
  accounts: Account[];
  tasks: Task[];
  tags: Tag[];
  lastUpdated: number;
}

export const saveDataToDrive = async (token: string, data: AppData): Promise<void> => {
  // 1. Find existing file
  const searchResponse = await fetch(`${DRIVE_API}?q=name='${FILENAME}' and 'appDataFolder' in parents&spaces=appDataFolder`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!searchResponse.ok) {
     throw new Error("Failed to search Drive");
  }

  const searchResult = await searchResponse.json();
  const fileId = searchResult.files?.[0]?.id;

  const fileContent = JSON.stringify(data);

  if (fileId) {
    // Update existing file content
    const updateResponse = await fetch(`${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!updateResponse.ok) {
      throw new Error("Failed to update Drive file");
    }
  } else {
    // Create new file with multipart/related
    const metadata = {
      name: FILENAME,
      parents: ['appDataFolder']
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const multipartBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      close_delim;

    const createResponse = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!createResponse.ok) {
      throw new Error("Failed to create Drive file");
    }
  }
};

export const loadDataFromDrive = async (token: string): Promise<AppData | null> => {
  // 1. Find file
  const searchResponse = await fetch(`${DRIVE_API}?q=name='${FILENAME}' and 'appDataFolder' in parents&spaces=appDataFolder`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!searchResponse.ok) return null;

  const searchResult = await searchResponse.json();
  const fileId = searchResult.files?.[0]?.id;

  if (!fileId) return null;

  // 2. Download content
  const contentResponse = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!contentResponse.ok) return null;
  
  return await contentResponse.json();
};
