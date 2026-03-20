// Icon components for better tree-shaking and reusability
import { defineComponent, h } from 'vue'

// Common icon props interface
interface IconProps {
  size?: number | string
  strokeWidth?: number | string
  class?: string
}

// Helper function to create icon components
const createIcon = (path: string, viewBox = '0 0 24 24') => {
  return defineComponent<IconProps>({
    name: 'Icon',
    props: {
      size: {
        type: [Number, String],
        default: 24
      },
      strokeWidth: {
        type: [Number, String],
        default: 2
      },
      class: {
        type: String,
        default: ''
      }
    },
    setup(props) {
      return () => h('svg', {
        width: String(props.size || 24),
        height: String(props.size || 24),
        viewBox,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': String(props.strokeWidth || 2),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        class: props.class || ''
      }, [
        h('path', { d: path })
      ])
    }
  })
}

// Navigation & UI Icons
export const ArrowLeftIcon = createIcon('m15 18-6-6 6-6')
export const ArrowRightIcon = createIcon('m9 18 6-6-6-6')
export const ChevronLeftIcon = createIcon('m15 18-6-6 6-6')
export const ChevronRightIcon = createIcon('m9 18 6-6-6-6')
export const ChevronDownIcon = createIcon('m6 9 6 6 6-6')
export const ChevronUpIcon = createIcon('m18 15-6-6-6 6')

// Action Icons
export const SendIcon = createIcon('m22 2-7 20-4-9-9-4 20-7z')
export const RefreshIcon = defineComponent<IconProps & { spinning?: boolean }>({
  name: 'RefreshIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' },
    spinning: { type: Boolean, default: false }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: [props.class || '', props.spinning ? 'animate-spin' : ''].filter(Boolean).join(' ')
    }, [
      h('path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }),
      h('path', { d: 'M21 3v5h-5' }),
      h('path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }),
      h('path', { d: 'M3 21v-5h5' })
    ])
  }
})

export const SearchIcon = createIcon('m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z')
export const FilterIcon = createIcon('M22 3H2l8 9.46V19l4 2v-8.54L22 3z')
export const MoreVerticalIcon = createIcon('M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0')

// User & People Icons
export const UserIcon = createIcon('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2')
export const UserPlusIcon = defineComponent<IconProps>({
  name: 'UserPlusIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: '9', cy: '7', r: '4' }),
      h('line', { x1: '19', x2: '19', y1: '8', y2: '14' }),
      h('line', { x1: '22', x2: '16', y1: '11', y2: '11' })
    ])
  }
})

export const UsersIcon = createIcon('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75')

// Alias for UsersIcon
export const UserGroupIcon = UsersIcon

export const TeamIcon = defineComponent<IconProps>({
  name: 'TeamIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: '9', cy: '7', r: '4' }),
      h('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }),
      h('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' })
    ])
  }
})

export const UserCheckIcon = defineComponent<IconProps>({
  name: 'UserCheckIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: '9', cy: '7', r: '4' }),
      h('polyline', { points: '16,11 18,13 22,9' })
    ])
  }
})

// Communication Icons
export const MessageCircleIcon = createIcon('M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z')
export const ChatIcon = createIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')
export const PhoneIcon = createIcon('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z')

// Status & Feedback Icons
export const CheckIcon = createIcon('M20 6 9 17l-5-5')
export const CheckCircleIcon = createIcon('M22 11.08V12a10 10 0 1 1-5.93-9.14')
export const XIcon = createIcon('M18 6 6 18M6 6l12 12')
export const XCircleIcon = defineComponent<IconProps>({
  name: 'XCircleIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('line', { x1: '15', x2: '9', y1: '9', y2: '15' }),
      h('line', { x1: '9', x2: '15', y1: '9', y2: '15' })
    ])
  }
})
export const AlertCircleIcon = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01')
export const InfoIcon = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4M12 8h.01')

// File & Media Icons
export const FileIcon = createIcon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8')
export const ImageIcon = createIcon('M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 1 2 2h14a2 2 0 0 0 2-2zM8.5 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21')
export const PaperclipIcon = createIcon('M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49')
export const DownloadIcon = createIcon('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')

// Emoji & Fun Icons
export const SmileIcon = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01')
export const HeartIcon = createIcon('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z')

// Settings & Config Icons
export const SettingsIcon = createIcon('M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z')
export const CogIcon = createIcon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z')

// Loading Icon
export const LoadingIcon = defineComponent<IconProps>({
  name: 'LoadingIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' })
    ])
  }
})

// Platform specific icons
export const LineIcon = defineComponent<IconProps>({
  name: 'LineIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      class: props.class || ''
    }, [
      h('path', { d: 'M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314' })
    ])
  }
})

export const FacebookIcon = defineComponent<IconProps>({
  name: 'FacebookIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      class: props.class || ''
    }, [
      h('path', { d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' })
    ])
  }
})

// Additional missing icons
export const ConnectIcon = createIcon('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71')
export const TestIcon = createIcon('M9 12l2 2 4-4')
export const UploadIcon = createIcon('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12')
export const UploadCloudIcon = defineComponent<IconProps>({
  name: 'UploadCloudIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242' }),
      h('path', { d: 'm12 12-3-3h2V6h2v3h2l-3 3z' })
    ])
  }
})
export const ClockIcon = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2')
export const HistoryIcon = createIcon('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5')

export const LoginIcon = defineComponent<IconProps>({
  name: 'LoginIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4' }),
      h('polyline', { points: '10 17 15 12 10 7' }),
      h('line', { x1: '15', y1: '12', x2: '3', y2: '12' })
    ])
  }
})

export const LogoutIcon = defineComponent<IconProps>({
  name: 'LogoutIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }),
      h('polyline', { points: '16 17 21 12 16 7' }),
      h('line', { x1: '21', y1: '12', x2: '9', y2: '12' })
    ])
  }
})

// System Settings Icons
export const IntegrationIcon = defineComponent<IconProps>({
  name: 'IntegrationIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' }),
      h('polyline', { points: '16,6 12,2 8,6' }),
      h('line', { x1: '12', x2: '12', y1: '2', y2: '15' })
    ])
  }
})

export const AdvancedIcon = defineComponent<IconProps>({
  name: 'AdvancedIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M3 3v5h5' }),
      h('path', { d: 'M3 8a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }),
      h('path', { d: 'M21 21v-5h-5' }),
      h('path', { d: 'M21 16a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' })
    ])
  }
})

export const SystemIcon = defineComponent<IconProps>({
  name: 'SystemIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('rect', { width: '20', height: '14', x: '2', y: '3', rx: '2' }),
      h('line', { x1: '8', x2: '16', y1: '21', y2: '21' }),
      h('line', { x1: '12', x2: '12', y1: '17', y2: '21' })
    ])
  }
})

// Media Icons
export const VideoIcon = defineComponent<IconProps>({
  name: 'VideoIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'm23 7-7 5 7 5V7z' }),
      h('rect', { width: '15', height: '9', x: '1', y: '7.5', rx: '2', ry: '2' })
    ])
  }
})

export const MusicIcon = defineComponent<IconProps>({
  name: 'MusicIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M9 18V5l12-2v13' }),
      h('circle', { cx: '6', cy: '18', r: '3' }),
      h('circle', { cx: '18', cy: '16', r: '3' })
    ])
  }
})

export const EyeIcon = defineComponent<IconProps>({
  name: 'EyeIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }),
      h('circle', { cx: '12', cy: '12', r: '3' })
    ])
  }
})

// Message Action Icons
export const CopyIcon = createIcon('M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2M9 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9')
export const ReplyIcon = createIcon('M9 17l-6-6 6-6M3 11h18')
export const ForwardIcon = createIcon('M15 17l6-6-6-6M21 11H3')
export const TrashIcon = createIcon('m3 6 3 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l3-14M8 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 11v6M14 11v6')


// Notification Icons
export const BellIcon = defineComponent<IconProps>({
  name: 'BellIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' }),
      h('path', { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' })
    ])
  }
})

export const BellOffIcon = defineComponent<IconProps>({
  name: 'BellOffIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5' }),
      h('path', { d: 'M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7' }),
      h('path', { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' }),
      h('path', { d: 'm2 2 20 20' })
    ])
  }
})

export const CheckAllIcon = defineComponent<IconProps>({
  name: 'CheckAllIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M18 6 7 17l-5-5' }),
      h('path', { d: 'm22 10-7.5 7.5L13 16' })
    ])
  }
})

export const AtSignIcon = defineComponent<IconProps>({
  name: 'AtSignIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('circle', { cx: '12', cy: '12', r: '4' }),
      h('path', { d: 'M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8' })
    ])
  }
})

export const AlertIcon = defineComponent<IconProps>({
  name: 'AlertIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }),
      h('path', { d: 'M12 9v4' }),
      h('path', { d: 'M12 17h.01' })
    ])
  }
})

export const MessageIcon = defineComponent<IconProps>({
  name: 'MessageIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
    ])
  }
})

// Additional Notification Page Icons
export const InboxIcon = defineComponent<IconProps>({
  name: 'InboxIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('polyline', { points: '22 12 16 12 14 15 10 15 8 12 2 12' }),
      h('path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' })
    ])
  }
})

export const CalendarIcon = defineComponent<IconProps>({
  name: 'CalendarIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('rect', { width: '18', height: '18', x: '3', y: '4', rx: '2', ry: '2' }),
      h('line', { x1: '16', x2: '16', y1: '2', y2: '6' }),
      h('line', { x1: '8', x2: '8', y1: '2', y2: '6' }),
      h('line', { x1: '3', x2: '21', y1: '10', y2: '10' })
    ])
  }
})

export const TrendingUpIcon = defineComponent<IconProps>({
  name: 'TrendingUpIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('polyline', { points: '22 7 13.5 15.5 8.5 10.5 2 17' }),
      h('polyline', { points: '16 7 22 7 22 13' })
    ])
  }
})

export const MailIcon = defineComponent<IconProps>({
  name: 'MailIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('rect', { width: '20', height: '16', x: '2', y: '4', rx: '2' }),
      h('path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' })
    ])
  }
})

export const VolumeIcon = defineComponent<IconProps>({
  name: 'VolumeIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
      h('path', { d: 'M15.54 8.46a5 5 0 0 1 0 7.07' }),
      h('path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14' })
    ])
  }
})

// Customer Tags Icons
export const AlertTriangleIcon = defineComponent<IconProps>({
  name: 'AlertTriangleIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }),
      h('path', { d: 'M12 9v4' }),
      h('path', { d: 'M12 17h.01' })
    ])
  }
})

export const BarChartIcon = defineComponent<IconProps>({
  name: 'BarChartIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('line', { x1: '12', x2: '12', y1: '20', y2: '10' }),
      h('line', { x1: '18', x2: '18', y1: '20', y2: '4' }),
      h('line', { x1: '6', x2: '6', y1: '20', y2: '16' })
    ])
  }
})

export const EditIcon = defineComponent<IconProps>({
  name: 'EditIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
      h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
    ])
  }
})

export const PlusIcon = createIcon('M12 5v14M5 12h14')

// Video Player Icons
export const PlayIcon = defineComponent<IconProps>({
  name: 'PlayIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      stroke: 'none',
      class: props.class || ''
    }, [
      h('polygon', { points: '5 3 19 12 5 21 5 3' })
    ])
  }
})

export const PauseIcon = defineComponent<IconProps>({
  name: 'PauseIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      stroke: 'none',
      class: props.class || ''
    }, [
      h('rect', { x: '6', y: '4', width: '4', height: '16' }),
      h('rect', { x: '14', y: '4', width: '4', height: '16' })
    ])
  }
})

export const VolumeMuteIcon = defineComponent<IconProps>({
  name: 'VolumeMuteIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5', fill: 'currentColor' }),
      h('line', { x1: '23', x2: '17', y1: '9', y2: '15' }),
      h('line', { x1: '17', x2: '23', y1: '9', y2: '15' })
    ])
  }
})

export const MaximizeIcon = defineComponent<IconProps>({
  name: 'MaximizeIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M8 3H5a2 2 0 0 0-2 2v3' }),
      h('path', { d: 'M21 8V5a2 2 0 0 0-2-2h-3' }),
      h('path', { d: 'M3 16v3a2 2 0 0 0 2 2h3' }),
      h('path', { d: 'M16 21h3a2 2 0 0 0 2-2v-3' })
    ])
  }
})

export const MinimizeIcon = defineComponent<IconProps>({
  name: 'MinimizeIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M8 3v3a2 2 0 0 1-2 2H3' }),
      h('path', { d: 'M21 8h-3a2 2 0 0 1-2-2V3' }),
      h('path', { d: 'M3 16h3a2 2 0 0 1 2 2v3' }),
      h('path', { d: 'M16 21v-3a2 2 0 0 1 2-2h3' })
    ])
  }
})

export const TagIcon = defineComponent<IconProps>({
  name: 'TagIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z' }),
      h('path', { d: 'M7 7h.01' })
    ])
  }
})

export const ExternalLinkIcon = defineComponent<IconProps>({
  name: 'ExternalLinkIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4' }),
      h('path', { d: 'M14 4h6m0 0v6m0-6L10 14' })
    ])
  }
})
