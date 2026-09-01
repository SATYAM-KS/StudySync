export interface SyllabusItem {
  id: string;
  title: string;
  link?: string;
}

export interface SyllabusModule {
  id: string;
  title: string;
  items: SyllabusItem[];
}

export interface SyllabusTrack {
  id: string;
  title: string;
  modules: SyllabusModule[];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Serializes structured tracks into clean, human-readable markdown
 */
export function serializeSyllabus(tracks: SyllabusTrack[]): string {
  const lines: string[] = [];

  tracks.forEach((track) => {
    if (track.title.trim()) {
      lines.push(`# ${track.title.trim()}`);
    }

    track.modules.forEach((mod) => {
      if (mod.title.trim()) {
        lines.push(`## ${mod.title.trim()}`);
      }

      mod.items.forEach((item) => {
        if (item.title.trim()) {
          if (item.link && item.link.trim()) {
            lines.push(`- ${item.title.trim()} [${item.link.trim()}]`);
          } else {
            lines.push(`- ${item.title.trim()}`);
          }
        }
      });

      lines.push('');
    });

    lines.push('');
  });

  return lines.join('\n').trim();
}

/**
 * Parses raw markdown/text into structured SyllabusTrack objects
 */
export function deserializeSyllabus(rawText?: string): SyllabusTrack[] {
  if (!rawText || !rawText.trim()) return [];

  const rawLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return [];

  const tracks: SyllabusTrack[] = [];
  let currentTrack: SyllabusTrack = {
    id: generateId(),
    title: 'Core Curriculum',
    modules: []
  };
  let currentModule: SyllabusModule | null = null;
  let hasExplicitTrack = false;

  rawLines.forEach((line) => {
    // 1. Track / Main Heading: # DSA or #DSA :- or [Track: DSA] or === DSA ===
    const mainHeaderMatch = line.match(/^#\s+([^#].*)|^(?:#|==+)\s*([A-Za-z0-9&\s\/_-]+)\s*(?:==+|:-)?$/);
    if (mainHeaderMatch && !line.startsWith('##')) {
      const trackTitle = (mainHeaderMatch[1] || mainHeaderMatch[2] || line.replace(/^[#=\s]+|[#=\s:-]+$/g, '')).trim();
      if (currentTrack.modules.length > 0 || hasExplicitTrack) {
        tracks.push(currentTrack);
      }
      currentTrack = {
        id: generateId(),
        title: trackTitle,
        modules: []
      };
      currentModule = null;
      hasExplicitTrack = true;
      return;
    }

    // 2. Module Heading: ## 1. Arrays or 1. Conditional or Module 1: React
    const moduleMatch = line.match(/^(?:##\s*|)(\d+[\.\)]\s*.*|Module\s+\d+:?.*|Week\s+\d+:?.*|Unit\s+\d+:?.*)/i);
    const altModuleMatch = line.match(/^##\s+(.*)/);
    if (moduleMatch || altModuleMatch) {
      const modTitle = (moduleMatch ? moduleMatch[1] : altModuleMatch![1]).trim();
      currentModule = {
        id: generateId(),
        title: modTitle,
        items: []
      };
      currentTrack.modules.push(currentModule);
      return;
    }

    // 3. Item / Problem / Resource: - Two Sum (LC 1) [https://...] or * Two Sum or Fizz Buzz (LC 412)
    let itemTitle = line;
    let itemLink = '';

    const linkMatch = line.match(/[\[\(](https?:\/\/[^\s\]\)]+)[\]\)]/);
    if (linkMatch) {
      itemLink = linkMatch[1];
      itemTitle = line.replace(/[\[\(]https?:\/\/[^\s\]\)]+[\]\)]/g, '').trim();
    }

    itemTitle = itemTitle.replace(/^[-*•]\s*/, '').trim();

    if (!itemTitle) return;

    if (!currentModule) {
      currentModule = {
        id: generateId(),
        title: 'General Topics',
        items: []
      };
      currentTrack.modules.push(currentModule);
    }

    currentModule.items.push({
      id: generateId(),
      title: itemTitle,
      link: itemLink
    });
  });

  if (currentTrack.modules.length > 0 || currentTrack.title !== 'Core Curriculum') {
    tracks.push(currentTrack);
  }

  return tracks.length > 0 ? tracks : [];
}

/**
 * CSE Engineering Preset Starter Templates
 */
export const CSE_TEMPLATES: Record<string, { label: string; color: string; track: SyllabusTrack }> = {
  dsa: {
    label: 'DSA',
    color: 'emerald',
    track: {
      id: 'dsa_track',
      title: 'Data Structures & Algorithms',
      modules: [
        {
          id: 'dsa_mod_1',
          title: '1. Arrays & Hashing',
          items: [
            { id: 'dsa_i_1', title: 'Two Sum (LC 1)', link: 'https://leetcode.com/problems/two-sum/' },
            { id: 'dsa_i_2', title: 'Contains Duplicate (LC 217)', link: 'https://leetcode.com/problems/contains-duplicate/' },
            { id: 'dsa_i_3', title: 'Valid Anagram (LC 242)', link: 'https://leetcode.com/problems/valid-anagram/' }
          ]
        },
        {
          id: 'dsa_mod_2',
          title: '2. Two Pointers & Sliding Window',
          items: [
            { id: 'dsa_i_4', title: 'Valid Palindrome (LC 125)', link: 'https://leetcode.com/problems/valid-palindrome/' },
            { id: 'dsa_i_5', title: 'Best Time to Buy & Sell Stock (LC 121)', link: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' }
          ]
        },
        {
          id: 'dsa_mod_3',
          title: '3. Trees & Binary Search',
          items: [
            { id: 'dsa_i_6', title: 'Invert Binary Tree (LC 226)', link: 'https://leetcode.com/problems/invert-binary-tree/' },
            { id: 'dsa_i_7', title: 'Maximum Depth of Binary Tree (LC 104)', link: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/' }
          ]
        },
        {
          id: 'dsa_mod_4',
          title: '4. Dynamic Programming & Graphs',
          items: [
            { id: 'dsa_i_8', title: 'Climbing Stairs (LC 70)', link: 'https://leetcode.com/problems/climbing-stairs/' },
            { id: 'dsa_i_9', title: 'Number of Islands (LC 200)', link: 'https://leetcode.com/problems/number-of-islands/' }
          ]
        }
      ]
    }
  },
  dev: {
    label: 'Development',
    color: 'cyan',
    track: {
      id: 'dev_track',
      title: 'Fullstack & Software Development',
      modules: [
        {
          id: 'dev_mod_1',
          title: '1. Frontend Architecture (React & Next.js)',
          items: [
            { id: 'dev_i_1', title: 'State Management & Custom Hooks', link: 'https://react.dev' },
            { id: 'dev_i_2', title: 'Server Components & Client Optimization', link: '' },
            { id: 'dev_i_3', title: 'Tailwind CSS & Responsive UI Design', link: '' }
          ]
        },
        {
          id: 'dev_mod_2',
          title: '2. Backend APIs & Database Architecture',
          items: [
            { id: 'dev_i_4', title: 'RESTful API & WebSockets Setup', link: '' },
            { id: 'dev_i_5', title: 'PostgreSQL, Indexes & Query Optimization', link: '' },
            { id: 'dev_i_6', title: 'JWT Authentication & Security Best Practices', link: '' }
          ]
        }
      ]
    }
  },
  core: {
    label: 'Core CS',
    color: 'amber',
    track: {
      id: 'core_track',
      title: 'Core Computer Science Subjects',
      modules: [
        {
          id: 'core_mod_1',
          title: '1. Operating Systems & Concurrency',
          items: [
            { id: 'core_i_1', title: 'Process Scheduling, Threads & Deadlocks', link: '' },
            { id: 'core_i_2', title: 'Virtual Memory & Paging Mechanisms', link: '' }
          ]
        },
        {
          id: 'core_mod_2',
          title: '2. Computer Networks & DBMS',
          items: [
            { id: 'core_i_3', title: 'TCP/IP, OSI Layers & HTTP/HTTPS Internals', link: '' },
            { id: 'core_i_4', title: 'ACID Properties, Normalization & B-Trees', link: '' }
          ]
        },
        {
          id: 'core_mod_3',
          title: '3. System Design Fundamentals',
          items: [
            { id: 'core_i_5', title: 'Load Balancers, Caching & CDN Strategy', link: '' },
            { id: 'core_i_6', title: 'Database Sharding & Consistency Models', link: '' }
          ]
        }
      ]
    }
  },
  comm: {
    label: 'Communication',
    color: 'violet',
    track: {
      id: 'comm_track',
      title: 'Communication & Interview Prep',
      modules: [
        {
          id: 'comm_mod_1',
          title: '1. Behavioral & Technical Communication',
          items: [
            { id: 'comm_i_1', title: 'STAR Method for Project & Behavioral Questions', link: '' },
            { id: 'comm_i_2', title: 'Explaining Complexity & Engineering Tradeoffs', link: '' }
          ]
        },
        {
          id: 'comm_mod_2',
          title: '2. Mock Interviews & System Walkthroughs',
          items: [
            { id: 'comm_i_3', title: 'Live Coding Pair Programming Practice', link: '' },
            { id: 'comm_i_4', title: 'Resume Project Deep-Dive Defense', link: '' }
          ]
        }
      ]
    }
  }
};
