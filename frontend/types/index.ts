// Core entity types - updated to match backend structure
export interface Client {
  id?: string;
  ClientID: number;
  ClientName: string;
  ClientEmail: string;
  PriorityLevel: number;
  Budget: number;
  _metadata?: {
    processedAt: string;
    source: string;
    entity: string;
  };
  // Legacy fields for compatibility
  name?: string;
  email?: string;
  priority?: number;
  createdAt?: string;
  updatedAt?: string;
  }
  
  export interface Worker {
  id?: string;
  WorkerID: number;
  WorkerName: string;
  WorkerEmail: string;
  Skills: string[];
  HourlyRate: number;
  Availability: 'available' | 'busy' | 'unavailable';
  _metadata?: {
    processedAt: string;
    source: string;
    entity: string;
  };
  // Legacy fields for compatibility
  name?: string;
  email?: string;
  skills?: string[];
  hourlyRate?: number;
  availability?: 'available' | 'busy' | 'unavailable';
  createdAt?: string;
  updatedAt?: string;
  }
  
  export interface Task {
  id?: string;
  TaskID: number;
  TaskTitle: string;
  TaskDescription: string;
  ClientID: number;
  WorkerID?: number;
  PriorityLevel: number;
  EstimatedHours: number;
  Status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  Deadline: string;
  _metadata?: {
    processedAt: string;
    source: string;
    entity: string;
  };
  // Legacy fields for compatibility
  title?: string;
  description?: string;
  clientId?: string;
    workerId?: string;
  priority?: number;
  estimatedHours?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  deadline?: string;
  createdAt?: string;
  updatedAt?: string;
  }
  
  export interface Rule {
    id: string;
    name: string;
    description: string;
    condition: string;
    action: string;
    priority: number;
    isActive: boolean;
    type: string;
    createdAt: string;
    updatedAt: string;
  }
  
  // API response types
  export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
  meta?: {
    timestamp: string;
    [key: string]: any;
  };
  }
  
  export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }

// Backend pagination response format
export interface BackendPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    timestamp: string;
  };
}
  
  // Upload types
  export interface UploadFile {
    filename: string;
    originalName: string;
    size: number;
    uploadedAt: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }
  
  export interface UploadStatus {
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    message?: string;
  }
  
  // AI types
  export interface AIQueryResult {
  success: boolean;
    query: string;
  results?: any[] | Record<string, any>; // Can be array for single entity or object for all entities
  filteredData?: any[]; // For single entity queries
  interpretedFilter?: string; // Explanation for single entity queries
  confidence?: number;
  explanation?: string; // For compatibility
  timestamp?: string;
  error?: string;
  }
  
  export interface AIRule {
    name: string;
    description: string;
    condition: string;
    action: string;
    confidence: number;
    type?: string;
  }
  
  export interface RuleRecommendation {
    type: 'coRun' | 'phaseWindow' | 'loadLimit' | 'slotRestriction' | 'precedenceOverride' | 'patternMatch';
    priority: 'high' | 'medium' | 'low';
    reason: string;
    suggestedRule: any;
    expectedBenefit: string;
    confidence: number;
  }
  
  export interface AIInsight {
    type: 'warning' | 'suggestion' | 'info';
    title: string;
    description: string;
    data?: any;
  }
  
  // Form types
  export interface EntityFilters {
    search?: string;
    status?: string;
    priority?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
  
  export interface RulePriorities {
  priorityLevelWeight: number;
  fairnessWeight: number;
  costWeight: number;
  }
  
  // Entity types union
  export type EntityType = 'clients' | 'workers' | 'tasks';
  export type EntityData = Client | Worker | Task;
  
  // Table column definition
  export interface TableColumn {
    key: string;
    originalKey?: string; // For dynamically generated columns
    label: string;
    sortable?: boolean;
    editable?: boolean;
    type?: 'text' | 'number' | 'date' | 'select' | 'email';
    options?: string[];
  }