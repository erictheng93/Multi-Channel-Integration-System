<template>
  <div class="mt-7 mb-0">
    <!-- Section Header -->
    <div class="flex justify-between items-center mb-5">
      <div class="flex items-center">
        <h3 class="flex items-center gap-2.5 text-gray-800 text-[1.375rem] font-bold m-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-primary-600"
          >
            <rect
              x="3"
              y="3"
              width="7"
              height="7"
            />
            <rect
              x="14"
              y="3"
              width="7"
              height="7"
            />
            <rect
              x="3"
              y="14"
              width="7"
              height="7"
            />
            <rect
              x="14"
              y="14"
              width="3"
              height="3"
            />
            <rect
              x="18"
              y="14"
              width="3"
              height="3"
            />
            <rect
              x="14"
              y="18"
              width="3"
              height="3"
            />
            <rect
              x="18"
              y="18"
              width="3"
              height="3"
            />
          </svg>
          QR Code 資訊
        </h3>
      </div>
      <button
        v-if="!qrCode && !loading"
        class="btn btn-sm btn-primary"
        :disabled="generating"
        @click="$emit('generate')"
      >
        {{ generating ? '生成中...' : '+ 生成 QR Code' }}
      </button>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex items-center justify-center p-10 bg-white rounded-xl border border-gray-200"
    >
      <HamsterLoader message="載入 QR Code 中..." />
    </div>

    <!-- No QR Code State -->
    <div
      v-else-if="!qrCode"
      class="qr-empty-state"
    >
      <div class="empty-qr-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
          />
          <rect
            x="14"
            y="3"
            width="7"
            height="7"
          />
          <rect
            x="3"
            y="14"
            width="7"
            height="7"
          />
          <rect
            x="14"
            y="14"
            width="3"
            height="3"
          />
          <rect
            x="18"
            y="14"
            width="3"
            height="3"
          />
          <rect
            x="14"
            y="18"
            width="3"
            height="3"
          />
          <rect
            x="18"
            y="18"
            width="3"
            height="3"
          />
        </svg>
      </div>
      <p class="text-gray-600 text-lg font-semibold m-0 mb-2">
        此團隊尚未生成 QR Code
      </p>
      <span class="text-gray-400 text-sm max-w-[300px] leading-relaxed">點擊上方按鈕生成專屬 QR Code，讓客戶輕鬆加入 LINE 官方帳號</span>
    </div>

    <!-- QR Code Display - Flex Layout -->
    <div
      v-else
      class="animate-fade-in-up"
    >
      <div class="flex gap-6 items-start md:flex-col md:items-center md:gap-5 sm:gap-4">
        <!-- Left: Flex Bubble Card -->
        <QRFlexBubbleCard
          :qr-code-url="qrCode.qrCodeUrl"
          :team-name="team.name"
          :loading="isDownloading"
          @download="handleDownload"
        />

        <!-- Right: Info Panel -->
        <QRInfoPanel
          :liff-url="qrCode.liffUrl"
          :scan-count="qrStats?.scanCount || 0"
          :assignment-count="qrStats?.assignmentCount || 0"
          :created-at="qrCode.createdAt"
          :regenerating="generating"
          @regenerate="$emit('generate')"
          @copy-url="handleCopyUrl"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * TeamQRSection Component
 *
 * Purpose: Orchestrate QR Code display and interactions
 * Extracted from TeamCard.vue (lines 214-493)
 *
 * Integrates:
 * - useQRCodeDownloader composable (Canvas rendering)
 * - QRFlexBubbleCard component (visual display)
 * - QRInfoPanel component (stats and actions)
 *
 * Responsibilities:
 * - QR Code download orchestration
 * - LIFF URL copying
 * - State management (loading, generating)
 * - Empty/loading state display
 */

import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import QRFlexBubbleCard from './QRFlexBubbleCard.vue'
import QRInfoPanel from './QRInfoPanel.vue'
import { useQRCodeDownloader } from '@/composables/team-management/useQRCodeDownloader'
import { useToast } from '@/composables/useToast'
import type { LiffQRCode } from '@/types'

interface Team {
  id: number
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface QRStats {
  scanCount: number
  assignmentCount: number
}

interface Props {
  /** Team object */
  team: Team

  /** QR Code data from store */
  qrCode: LiffQRCode | null

  /** Loading state for QR Code data */
  loading?: boolean

  /** Generating/regenerating state */
  generating?: boolean

  /** QR statistics (optional) */
  qrStats?: QRStats | null
}

interface Emits {
  /** Emitted when generate/regenerate button is clicked */
  (_e: 'generate'): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const { showSuccess, showError } = useToast()
const { isDownloading, downloadQRCodeCard } = useQRCodeDownloader()

/**
 * Handle QR Code download
 * Triggers Canvas rendering and PNG download
 */
const handleDownload = async () => {
  if (!props.qrCode) {
    return
  }

  await downloadQRCodeCard({
    qrCodeUrl: props.qrCode.qrCodeUrl,
    teamName: props.team.name
  })
}

/**
 * Handle LIFF URL copy to clipboard
 */
const handleCopyUrl = async () => {
  if (!props.qrCode?.liffUrl) {
    return
  }

  try {
    await navigator.clipboard.writeText(props.qrCode.liffUrl)
    showSuccess('LIFF 連結已複製到剪貼簿')
  } catch (error) {
    console.error('複製失敗:', error)
    showError('複製連結失敗')
  }
}
</script>

<style scoped>
/* ============================================
   Complex Gradients (Cannot use Tailwind)
   ============================================ */

/* Empty State - Gradient background */
.qr-empty-state {
  @apply flex flex-col items-center justify-center py-12 px-6;
  @apply border-2 border-dashed border-gray-300 rounded-2xl text-center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

/* Empty Icon - Gradient background with transparency */
.empty-qr-icon {
  @apply w-20 h-20 flex items-center justify-center rounded-[20px] mb-4 text-primary-600;
  background: linear-gradient(135deg, #667eea20, #764ba220);
}
</style>
