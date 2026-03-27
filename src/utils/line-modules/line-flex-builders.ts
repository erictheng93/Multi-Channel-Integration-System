import type { LineReplyMessage, LineFlexBubble, LineFlexComponent } from '../../types';

/**
 * 根據 MIME 類型和檔案名獲取檔案類型資訊
 */
export function getFileTypeInfo(mimeType: string, filename: string): {
  icon: string;
  label: string;
  typeName: string;
  headerColor: string;
  buttonColor: string;
} {
  const mime = mimeType.toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // PDF
  if (mime.includes('pdf') || ext === 'pdf') {
    return {
      icon: 'PDF',
      label: 'PDF 文件',
      typeName: 'PDF 文檔',
      headerColor: '#E53935',
      buttonColor: '#E53935'
    };
  }

  // Word
  if (mime.includes('word') || mime.includes('document') || ['doc', 'docx'].includes(ext)) {
    return {
      icon: 'DOC',
      label: 'Word 文件',
      typeName: 'Word 文檔',
      headerColor: '#2196F3',
      buttonColor: '#2196F3'
    };
  }

  // Excel
  if (mime.includes('excel') || mime.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      icon: 'XLS',
      label: 'Excel 文件',
      typeName: 'Excel 表格',
      headerColor: '#4CAF50',
      buttonColor: '#4CAF50'
    };
  }

  // PowerPoint
  if (mime.includes('powerpoint') || mime.includes('presentation') || ['ppt', 'pptx'].includes(ext)) {
    return {
      icon: 'PPT',
      label: 'PPT 文件',
      typeName: 'PowerPoint 簡報',
      headerColor: '#FF9800',
      buttonColor: '#FF9800'
    };
  }

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return {
      icon: 'IMG',
      label: '圖片',
      typeName: '圖片檔案',
      headerColor: '#00BCD4',
      buttonColor: '#00BCD4'
    };
  }

  // Video
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return {
      icon: 'VID',
      label: '影片',
      typeName: '影片檔案',
      headerColor: '#9C27B0',
      buttonColor: '#9C27B0'
    };
  }

  // Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
    return {
      icon: 'AUD',
      label: '音訊',
      typeName: '音訊檔案',
      headerColor: '#E91E63',
      buttonColor: '#E91E63'
    };
  }

  // Archive
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') ||
      ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      icon: 'ZIP',
      label: '壓縮檔',
      typeName: '壓縮檔案',
      headerColor: '#795548',
      buttonColor: '#795548'
    };
  }

  // Text files
  if (mime.includes('text') || ['txt', 'md', 'json', 'xml', 'log'].includes(ext)) {
    return {
      icon: 'TXT',
      label: '文字檔',
      typeName: '文字文件',
      headerColor: '#607D8B',
      buttonColor: '#607D8B'
    };
  }

  // Code files
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'vue', 'jsx', 'tsx'].includes(ext)) {
    return {
      icon: 'CODE',
      label: '程式碼',
      typeName: '程式檔案',
      headerColor: '#3F51B5',
      buttonColor: '#3F51B5'
    };
  }

  // Default
  return {
    icon: 'FILE',
    label: '檔案',
    typeName: '檔案',
    headerColor: '#9C27B0',
    buttonColor: '#9C27B0'
  };
}

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * 建立檔案附件 Flex Message (LINE 風格卡片)
 *
 * @param fileUrl - 檔案下載 URL
 * @param filename - 檔案名稱
 * @param mimeType - MIME 類型
 * @param fileSize - 檔案大小 (bytes)
 * @returns Flex Message 對象
 */
export function createFileFlexMessage(
  fileUrl: string,
  filename: string,
  mimeType: string = '',
  fileSize: number = 0
): LineReplyMessage {
  const fileInfo = getFileTypeInfo(mimeType, filename);
  const formattedSize = formatFileSize(fileSize);

  // Truncate long filenames
  const maxLength = 30;
  let displayFilename = filename;
  if (filename.length > maxLength) {
    const extension = filename.split('.').pop() || '';
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const availableLength = maxLength - extension.length - 4;
    displayFilename = `${nameWithoutExt.substring(0, availableLength)}...${extension ? `.${extension}` : ''}`;
  }

  const flexBubble: LineFlexBubble = {
    type: 'bubble',
    styles: {
      header: {
        backgroundColor: fileInfo.headerColor
      },
      footer: {
        backgroundColor: '#f8f9fa'
      }
    },
    header: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: fileInfo.icon,
          size: 'xl',
          color: '#ffffff'
        },
        {
          type: 'text',
          text: fileInfo.label,
          size: 'lg',
          weight: 'bold',
          color: '#ffffff',
          margin: 'sm'
        }
      ],
      paddingAll: '14px',
      justifyContent: 'center',
      alignItems: 'center'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: displayFilename,
          weight: 'bold',
          size: 'md',
          wrap: true,
          color: '#333333'
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: fileInfo.typeName,
              size: 'sm',
              color: '#888888',
              flex: 1
            } satisfies LineFlexComponent,
            ...(formattedSize ? [{
              type: 'text' as const,
              text: formattedSize,
              size: 'sm',
              color: '#888888',
              align: 'end'
            }] : [])
          ],
          margin: 'md'
        },
        {
          type: 'separator',
          margin: 'lg',
          color: '#eeeeee'
        },
        {
          type: 'text',
          text: '點擊下方按鈕下載或開啟檔案',
          size: 'xs',
          color: '#aaaaaa',
          align: 'center',
          margin: 'md'
        }
      ],
      paddingAll: '14px'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '打開此文件',
            uri: fileUrl
          },
          style: 'primary',
          color: fileInfo.buttonColor,
          height: 'sm'
        }
      ],
      paddingAll: '10px'
    }
  };

  return {
    type: 'flex',
    altText: `[${fileInfo.label}] ${filename}`,
    contents: flexBubble
  };
}

/**
 * 建立圖片附件 Flex Message (LINE 風格卡片 - 含圖片預覽)
 *
 * @param imageUrl - 圖片 URL
 * @param filename - 檔案名稱
 * @param fileSize - 檔案大小 (bytes)
 * @returns Flex Message 對象
 */
export function createImageFlexMessage(
  imageUrl: string,
  filename: string,
  fileSize: number = 0
): LineReplyMessage {
  const formattedSize = formatFileSize(fileSize);

  // Truncate long filenames
  const maxLength = 25;
  let displayFilename = filename;
  if (filename.length > maxLength) {
    const extension = filename.split('.').pop() || '';
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const availableLength = maxLength - extension.length - 4;
    displayFilename = `${nameWithoutExt.substring(0, availableLength)}...${extension ? `.${extension}` : ''}`;
  }

  const flexBubble: LineFlexBubble = {
    type: 'bubble',
    styles: {
      header: {
        backgroundColor: '#00BCD4'
      },
      footer: {
        backgroundColor: '#f8f9fa'
      }
    },
    header: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '',
          size: 'xl',
          color: '#ffffff'
        },
        {
          type: 'text',
          text: '圖片',
          size: 'lg',
          weight: 'bold',
          color: '#ffffff',
          margin: 'sm'
        }
      ],
      paddingAll: '14px',
      justifyContent: 'center',
      alignItems: 'center'
    },
    hero: {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '4:3',
      aspectMode: 'cover',
      action: {
        type: 'uri',
        uri: imageUrl
      }
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: displayFilename,
          weight: 'bold',
          size: 'md',
          wrap: true,
          color: '#333333'
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '圖片檔案',
              size: 'sm',
              color: '#888888',
              flex: 1
            } satisfies LineFlexComponent,
            ...(formattedSize ? [{
              type: 'text' as const,
              text: formattedSize,
              size: 'sm',
              color: '#888888',
              align: 'end'
            }] : [])
          ],
          margin: 'md'
        },
        {
          type: 'separator',
          margin: 'lg',
          color: '#eeeeee'
        },
        {
          type: 'text',
          text: '點擊下方按鈕下載或開啟圖片',
          size: 'xs',
          color: '#aaaaaa',
          align: 'center',
          margin: 'md'
        }
      ],
      paddingAll: '14px'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '打開此圖片',
            uri: imageUrl
          },
          style: 'primary',
          color: '#00BCD4',
          height: 'sm'
        }
      ],
      paddingAll: '10px'
    }
  };

  return {
    type: 'flex',
    altText: `[圖片] ${filename}`,
    contents: flexBubble
  };
}
