import Papa from 'papaparse';
import XLSX from 'xlsx';
import fs from 'fs-extra';

/**
 * Comprehensive header mapping for maximum flexibility
 * Supports multiple languages, terminologies, and formats
 */
const headerMappings = {
  // CLIENT ID MAPPINGS - Very flexible for any ID field
  'client id': 'ClientID',
  'clientid': 'ClientID',
  'client_id': 'ClientID',
  'id': 'ClientID',
  'client identifier': 'ClientID',
  'customer id': 'ClientID',
  'customerid': 'ClientID',
  'customer_id': 'ClientID',
  'account id': 'ClientID',
  'accountid': 'ClientID',
  'account_id': 'ClientID',
  'user id': 'ClientID',
  'userid': 'ClientID',
  'user_id': 'ClientID',
  'reference': 'ClientID',
  'ref': 'ClientID',
  'code': 'ClientID',
  'client code': 'ClientID',
  'customer code': 'ClientID',
  'number': 'ClientID',
  'client number': 'ClientID',
  'customer number': 'ClientID',
  
  // CLIENT NAME MAPPINGS
  'name': 'ClientName',
  'client name': 'ClientName',
  'clientname': 'ClientName',
  'client_name': 'ClientName',
  'customer name': 'ClientName',
  'customername': 'ClientName',
  'customer_name': 'ClientName',
  'account name': 'ClientName',
  'accountname': 'ClientName',
  'account_name': 'ClientName',
  'company': 'ClientName',
  'company name': 'ClientName',
  'companyname': 'ClientName',
  'company_name': 'ClientName',
  'organization': 'ClientName',
  'organisation': 'ClientName',
  'org': 'ClientName',
  'title': 'ClientName',
  'full name': 'ClientName',
  'fullname': 'ClientName',
  'full_name': 'ClientName',
  
  // PRIORITY MAPPINGS - Very flexible
  'priority': 'PriorityLevel',
  'priority level': 'PriorityLevel',
  'prioritylevel': 'PriorityLevel',
  'priority_level': 'PriorityLevel',
  'importance': 'PriorityLevel',
  'urgency': 'PriorityLevel',
  'level': 'PriorityLevel',
  'rank': 'PriorityLevel',
  'ranking': 'PriorityLevel',
  'grade': 'PriorityLevel',
  'rating': 'PriorityLevel',
  'score': 'PriorityLevel',
  'weight': 'PriorityLevel',
  'value': 'PriorityLevel',
  'tier': 'PriorityLevel',
  'class': 'PriorityLevel',
  'category': 'PriorityLevel',
  'status': 'PriorityLevel',
  
  // WORKER ID MAPPINGS
  'worker id': 'WorkerID',
  'workerid': 'WorkerID',
  'worker_id': 'WorkerID',
  'employee id': 'WorkerID',
  'employeeid': 'WorkerID',
  'employee_id': 'WorkerID',
  'staff id': 'WorkerID',
  'staffid': 'WorkerID',
  'staff_id': 'WorkerID',
  'team member id': 'WorkerID',
  'member id': 'WorkerID',
  'memberid': 'WorkerID',
  'member_id': 'WorkerID',
  'resource id': 'WorkerID',
  'resourceid': 'WorkerID',
  'resource_id': 'WorkerID',
  'person id': 'WorkerID',
  'personid': 'WorkerID',
  'person_id': 'WorkerID',
  
  // WORKER NAME MAPPINGS
  'worker name': 'WorkerName',
  'workername': 'WorkerName',
  'worker_name': 'WorkerName',
  'employee name': 'WorkerName',
  'employeename': 'WorkerName',
  'employee_name': 'WorkerName',
  'staff name': 'WorkerName',
  'staffname': 'WorkerName',
  'staff_name': 'WorkerName',
  'team member': 'WorkerName',
  'teammember': 'WorkerName',
  'team_member': 'WorkerName',
  'member name': 'WorkerName',
  'membername': 'WorkerName',
  'member_name': 'WorkerName',
  'resource name': 'WorkerName',
  'resourcename': 'WorkerName',
  'resource_name': 'WorkerName',
  'person name': 'WorkerName',
  'personname': 'WorkerName',
  'person_name': 'WorkerName',
  'first name': 'WorkerName',
  'firstname': 'WorkerName',
  'first_name': 'WorkerName',
  
  // SKILLS MAPPINGS - Very comprehensive
  'skills': 'Skills',
  'skill': 'Skills',
  'skill set': 'Skills',
  'skillset': 'Skills',
  'skill_set': 'Skills',
  'abilities': 'Skills',
  'ability': 'Skills',
  'capabilities': 'Skills',
  'capability': 'Skills',
  'competencies': 'Skills',
  'competency': 'Skills',
  'expertise': 'Skills',
  'experience': 'Skills',
  'qualifications': 'Skills',
  'qualification': 'Skills',
  'technologies': 'Skills',
  'technology': 'Skills',
  'tech': 'Skills',
  'tools': 'Skills',
  'tool': 'Skills',
  'programming languages': 'Skills',
  'languages': 'Skills',
  'language': 'Skills',
  'frameworks': 'Skills',
  'framework': 'Skills',
  'specialization': 'Skills',
  'specializations': 'Skills',
  'specialty': 'Skills',
  'specialties': 'Skills',
  
  // AVAILABILITY/SLOTS MAPPINGS
  'available slots': 'AvailableSlots',
  'availableslots': 'AvailableSlots',
  'available_slots': 'AvailableSlots',
  'slots': 'AvailableSlots',
  'time slots': 'AvailableSlots',
  'timeslots': 'AvailableSlots',
  'time_slots': 'AvailableSlots',
  'availability': 'AvailableSlots',
  'available': 'AvailableSlots',
  'schedule': 'AvailableSlots',
  'calendar': 'AvailableSlots',
  'working hours': 'AvailableSlots',
  'workinghours': 'AvailableSlots',
  'working_hours': 'AvailableSlots',
  'hours': 'AvailableSlots',
  'time': 'AvailableSlots',
  'periods': 'AvailableSlots',
  'period': 'AvailableSlots',
  'shifts': 'AvailableSlots',
  'shift': 'AvailableSlots',
  'blocks': 'AvailableSlots',
  'block': 'AvailableSlots',
  
  // CAPACITY/LOAD MAPPINGS
  'max load per phase': 'MaxLoadPerPhase',
  'maxloadperphase': 'MaxLoadPerPhase',
  'max_load_per_phase': 'MaxLoadPerPhase',
  'max load': 'MaxLoadPerPhase',
  'maxload': 'MaxLoadPerPhase',
  'max_load': 'MaxLoadPerPhase',
  'capacity': 'MaxLoadPerPhase',
  'maximum capacity': 'MaxLoadPerPhase',
  'max capacity': 'MaxLoadPerPhase',
  'maxcapacity': 'MaxLoadPerPhase',
  'max_capacity': 'MaxLoadPerPhase',
  'workload': 'MaxLoadPerPhase',
  'work load': 'MaxLoadPerPhase',
  'work_load': 'MaxLoadPerPhase',
  'bandwidth': 'MaxLoadPerPhase',
  'throughput': 'MaxLoadPerPhase',
  'limit': 'MaxLoadPerPhase',
  'maximum': 'MaxLoadPerPhase',
  'max': 'MaxLoadPerPhase',
  'ceiling': 'MaxLoadPerPhase',
  'threshold': 'MaxLoadPerPhase',
  
  // TASK ID MAPPINGS
  'task id': 'TaskID',
  'taskid': 'TaskID',
  'task_id': 'TaskID',
  'job id': 'TaskID',
  'jobid': 'TaskID',
  'job_id': 'TaskID',
  'project id': 'TaskID',
  'projectid': 'TaskID',
  'project_id': 'TaskID',
  'work id': 'TaskID',
  'workid': 'TaskID',
  'work_id': 'TaskID',
  'assignment id': 'TaskID',
  'assignmentid': 'TaskID',
  'assignment_id': 'TaskID',
  'item id': 'TaskID',
  'itemid': 'TaskID',
  'item_id': 'TaskID',
  
  // TASK NAME MAPPINGS
  'task name': 'TaskName',
  'taskname': 'TaskName',
  'task_name': 'TaskName',
  'job name': 'TaskName',
  'jobname': 'TaskName',
  'job_name': 'TaskName',
  'project name': 'TaskName',
  'projectname': 'TaskName',
  'project_name': 'TaskName',
  'work name': 'TaskName',
  'workname': 'TaskName',
  'work_name': 'TaskName',
  'assignment': 'TaskName',
  'assignment name': 'TaskName',
  'assignmentname': 'TaskName',
  'assignment_name': 'TaskName',
  'description': 'TaskName',
  'task description': 'TaskName',
  'job description': 'TaskName',
  'work description': 'TaskName',
  'summary': 'TaskName',
  'subject': 'TaskName',
  'topic': 'TaskName',
  
  // REQUIRED SKILLS MAPPINGS
  'required skills': 'RequiredSkills',
  'requiredskills': 'RequiredSkills',
  'required_skills': 'RequiredSkills',
  'needed skills': 'RequiredSkills',
  'neededskills': 'RequiredSkills',
  'needed_skills': 'RequiredSkills',
  'skill requirements': 'RequiredSkills',
  'skill_requirements': 'RequiredSkills',
  'requirements': 'RequiredSkills',
  'prerequisites': 'RequiredSkills',
  'pre-requisites': 'RequiredSkills',
  'qualifications needed': 'RequiredSkills',
  'must have skills': 'RequiredSkills',
  'essential skills': 'RequiredSkills',
  'core skills': 'RequiredSkills',
  'key skills': 'RequiredSkills',
  'primary skills': 'RequiredSkills',
  'technical requirements': 'RequiredSkills',
  'tech requirements': 'RequiredSkills',
  'competencies required': 'RequiredSkills',
  'expertise needed': 'RequiredSkills',
  
  // DURATION MAPPINGS
  'duration': 'Duration',
  'time': 'Duration',
  'hours': 'Duration',
  'estimated hours': 'Duration',
  'estimatedhours': 'Duration',
  'estimated_hours': 'Duration',
  'effort': 'Duration',
  'work effort': 'Duration',
  'workeffort': 'Duration',
  'work_effort': 'Duration',
  'time required': 'Duration',
  'timerequired': 'Duration',
  'time_required': 'Duration',
  'expected duration': 'Duration',
  'expected_duration': 'Duration',
  'estimated duration': 'Duration',
  'estimated_duration': 'Duration',
  'length': 'Duration',
  'period': 'Duration',
  'timeframe': 'Duration',
  'time frame': 'Duration',
  'time_frame': 'Duration',
  'days': 'Duration',
  'weeks': 'Duration',
  'months': 'Duration',
  
  // PHASE MAPPINGS
  'phase': 'PreferredPhases',
  'phases': 'PreferredPhases',
  'preferred phases': 'PreferredPhases',
  'preferredphases': 'PreferredPhases',
  'preferred_phases': 'PreferredPhases',
  'timeline': 'PreferredPhases',
  'schedule': 'PreferredPhases',
  'timing': 'PreferredPhases',
  'when': 'PreferredPhases',
  'stage': 'PreferredPhases',
  'stages': 'PreferredPhases',
  'milestone': 'PreferredPhases',
  'milestones': 'PreferredPhases',
  'sprint': 'PreferredPhases',
  'sprints': 'PreferredPhases',
  'iteration': 'PreferredPhases',
  'iterations': 'PreferredPhases',
  'cycle': 'PreferredPhases',
  'cycles': 'PreferredPhases',
  
  // CONCURRENCY MAPPINGS
  'max concurrent': 'MaxConcurrent',
  'maxconcurrent': 'MaxConcurrent',
  'max_concurrent': 'MaxConcurrent',
  'concurrency': 'MaxConcurrent',
  'parallel': 'MaxConcurrent',
  'simultaneous': 'MaxConcurrent',
  'at once': 'MaxConcurrent',
  'together': 'MaxConcurrent',
  'same time': 'MaxConcurrent',
  'concurrent': 'MaxConcurrent',
  'parallelism': 'MaxConcurrent',
  
  // ADDITIONAL FLEXIBLE MAPPINGS
  'email': 'Email',
  'e-mail': 'Email',
  'mail': 'Email',
  'contact': 'Email',
  'phone': 'Phone',
  'telephone': 'Phone',
  'mobile': 'Phone',
  'cell': 'Phone',
  'budget': 'Budget',
  'cost': 'Budget',
  'price': 'Budget',
  'amount': 'Budget',
  'fee': 'Budget',
  'rate': 'Budget',
  'salary': 'Budget',
  'wage': 'Budget',
  'department': 'Department',
  'dept': 'Department',
  'division': 'Department',
  'team': 'Department',
  'group': 'Department',
  'unit': 'Department',
  'location': 'Location',
  'office': 'Location',
  'site': 'Location',
  'address': 'Location',
  'city': 'Location',
  'country': 'Location',
  'region': 'Location'
};

/**
 * Normalize column headers using the mapping
 */
export const normalizeHeaders = (headers) => {
  return headers.map(header => {
    const normalizedKey = header.toLowerCase().trim();
    return headerMappings[normalizedKey] || header;
  });
};

/**
 * Parse CSV file
 */
export const parseCSV = async (filePath) => {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    
    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => {
          const normalizedKey = header.toLowerCase().trim();
          return headerMappings[normalizedKey] || header;
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
          }
          resolve({
            data: results.data,
            errors: results.errors,
            meta: results.meta
          });
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to read CSV file: ${error.message}`);
  }
};

/**
 * Parse Excel file (XLSX/XLS)
 */
export const parseExcel = async (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false
    });
    
    if (jsonData.length === 0) {
      throw new Error('Excel file is empty');
    }
    
    // Extract headers and normalize them
    const headers = normalizeHeaders(jsonData[0]);
    const rows = jsonData.slice(1);
    
    // Convert to object format
    const data = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
    
    return {
      data,
      errors: [],
      meta: {
        fields: headers,
        delimiter: null,
        linebreak: null,
        aborted: false,
        truncated: false,
        cursor: data.length
      }
    };
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
};

/**
 * Convert data to CSV format
 */
export const convertToCSV = (data, headers = null) => {
  if (!data || data.length === 0) {
    return '';
  }
  
  const csvHeaders = headers || Object.keys(data[0]);
  
  return Papa.unparse({
    fields: csvHeaders,
    data: data
  });
};

/**
 * Parse array-like strings (e.g., "[1,2,3]" or "skill1,skill2,skill3")
 */
export const parseArrayField = (value) => {
  if (!value) return [];
  
  // Handle string representation
  if (typeof value === 'string') {
    // Remove brackets and split by comma
    const cleaned = value.replace(/[\[\]]/g, '').trim();
    if (!cleaned) return [];
    
    return cleaned.split(',').map(item => item.trim()).filter(item => item);
  }
  
  // Handle array
  if (Array.isArray(value)) {
    return value;
  }
  
  // Handle single value
  return [String(value).trim()];
};

/**
 * Smart entity detection based on column names
 */
export const detectEntityType = (headers) => {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Score each entity type based on matching columns
  const scores = {
    clients: 0,
    workers: 0,
    tasks: 0
  };
  
  normalizedHeaders.forEach(header => {
    // Client indicators
    if (header.includes('client') || header.includes('customer') || header.includes('account')) {
      scores.clients += 3;
    }
    if (header.includes('priority') || header.includes('importance') || header.includes('urgency')) {
      scores.clients += 2;
      scores.tasks += 1; // Tasks can also have priority
    }
    if (header.includes('budget') || header.includes('cost') || header.includes('company')) {
      scores.clients += 2;
    }
    
    // Worker indicators
    if (header.includes('worker') || header.includes('employee') || header.includes('staff') || header.includes('resource')) {
      scores.workers += 3;
    }
    if (header.includes('skill') || header.includes('ability') || header.includes('competenc') || header.includes('expertise')) {
      scores.workers += 2;
      scores.tasks += 1; // Tasks require skills too
    }
    if (header.includes('slot') || header.includes('availab') || header.includes('schedule') || header.includes('capacity')) {
      scores.workers += 2;
    }
    if (header.includes('load') || header.includes('workload') || header.includes('bandwidth')) {
      scores.workers += 2;
    }
    
    // Task indicators
    if (header.includes('task') || header.includes('job') || header.includes('project') || header.includes('assignment')) {
      scores.tasks += 3;
    }
    if (header.includes('duration') || header.includes('time') || header.includes('hours') || header.includes('effort')) {
      scores.tasks += 2;
    }
    if (header.includes('required') || header.includes('needed') || header.includes('prerequisite')) {
      scores.tasks += 1;
    }
    if (header.includes('concurrent') || header.includes('parallel') || header.includes('phase')) {
      scores.tasks += 2;
    }
  });
  
  // Return the entity type with the highest score
  const maxScore = Math.max(scores.clients, scores.workers, scores.tasks);
  if (maxScore === 0) return null; // Cannot determine
  
  return Object.keys(scores).find(key => scores[key] === maxScore);
};

/**
 * Flexible validation that only checks for truly essential data
 */
export const validateDataStructure = (data, entity) => {
  const errors = [];
  
  if (!data || !Array.isArray(data)) {
    errors.push({ message: 'Invalid data format - expected array' });
    return errors;
  }
  
  if (data.length === 0) {
    errors.push({ message: 'No data rows found' });
    return errors;
  }
  
  const firstRow = data[0];
  const headers = Object.keys(firstRow);
  
  // If entity type wasn't provided or is unclear, try to detect it
  let detectedEntity = entity;
  if (!entity || !['clients', 'workers', 'tasks'].includes(entity)) {
    detectedEntity = detectEntityType(headers);
    if (!detectedEntity) {
      // If we can't detect the entity type, we'll be very lenient
      // Just check that there's at least one ID-like column
      const hasIdColumn = headers.some(h => {
        const normalized = h.toLowerCase();
        return normalized.includes('id') || normalized === 'name' || normalized === 'title';
      });
      
      if (!hasIdColumn) {
        errors.push({ 
          message: 'No identifier column found. Please include at least one ID, name, or title column.',
          type: 'missing_identifier',
          suggestion: 'Add a column like "ID", "Name", "Title", "ClientID", "WorkerID", or "TaskID"'
        });
      }
      return errors;
    }
  }
  
  // Very flexible requirements - only check for the most essential fields
  const essentialFields = {
    clients: {
      id: ['ClientID', 'ID', 'Name', 'ClientName', 'CustomerID', 'AccountID'], // At least one identifier
      optional: ['PriorityLevel', 'Priority', 'Importance'] // Nice to have but not required
    },
    workers: {
      id: ['WorkerID', 'ID', 'Name', 'WorkerName', 'EmployeeID', 'StaffID'], // At least one identifier
      optional: ['Skills', 'Abilities', 'Expertise'] // Nice to have but not required
    },
    tasks: {
      id: ['TaskID', 'ID', 'Name', 'TaskName', 'JobID', 'ProjectID'], // At least one identifier
      optional: ['Duration', 'Hours', 'RequiredSkills'] // Nice to have but not required
    }
  };
  
  const requirements = essentialFields[detectedEntity];
  if (!requirements) return errors; // Unknown entity type, skip validation
  
  // Check for at least one identifier field
  const hasIdentifier = requirements.id.some(field => headers.includes(field));
  if (!hasIdentifier) {
    const suggestions = requirements.id.slice(0, 3).join(', ');
    errors.push({ 
      message: `Missing identifier column for ${detectedEntity}. Need at least one of: ${suggestions}`,
      type: 'missing_identifier',
      column: requirements.id[0],
      suggestion: `Add a column like: ${suggestions}`
      });
    }
  
  // Provide helpful suggestions for optional fields (warnings, not errors)
  const missingOptional = requirements.optional.filter(field => !headers.includes(field));
  if (missingOptional.length > 0) {
    errors.push({ 
      message: `Optional columns that could improve data quality: ${missingOptional.join(', ')}`,
      type: 'suggestion',
      severity: 'info',
      suggestion: `Consider adding: ${missingOptional.join(', ')} for better functionality`
  });
  }
  
  return errors;
};