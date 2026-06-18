"use client";

import React, { useRef, useEffect, useState } from "react";
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface Node {
  id: string;
  label: string;
  type: "candidate" | "job" | "team";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Edge {
  source: string;
  target: string;
  type: "matches" | "related_to" | "transferable_to";
}

interface TalentGraphProps {
  candidateSkills?: string[];
  jobSkills?: string[];
  teamSkills?: string[];
}

export function TalentGraph({ 
  candidateSkills = ["Python", "FastAPI", "React", "PostgreSQL", "AWS"], 
  jobSkills = ["Python", "FastAPI", "Docker", "Kubernetes", "Redis"], 
  teamSkills = ["Go", "React", "TypeScript", "PostgreSQL", "AWS"] 
}: TalentGraphProps) {
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeDragNode, setActiveDragNode] = useState<Node | null>(null);

  // Maintain simulation nodes and edges in refs so they persist across renders
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // Setup nodes and edges based on inputs
  useEffect(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const width = 600;
    const height = 350;

    // Helper to add nodes unique by id
    const addNode = (id: string, type: "candidate" | "job" | "team") => {
      if (!nodes.some(n => n.id === id)) {
        // Distribute nodes randomly near center
        nodes.push({
          id,
          label: id,
          type,
          x: width / 2 + (Math.random() - 0.5) * 150,
          y: height / 2 + (Math.random() - 0.5) * 150,
          vx: 0,
          vy: 0,
          radius: type === "job" ? 22 : type === "candidate" ? 18 : 16,
        });
      }
    };

    // Populate nodes
    jobSkills.forEach(s => addNode(s, "job"));
    candidateSkills.forEach(s => addNode(s, "candidate"));
    teamSkills.forEach(s => addNode(s, "team"));

    const jobLower = jobSkills.map(s => s.toLowerCase());
    const candLower = candidateSkills.map(s => s.toLowerCase());
    const teamLower = teamSkills.map(s => s.toLowerCase());

    // Populate edges
    // 1. Matches (skills candidate has that are job required)
    candidateSkills.forEach(cSkill => {
      const match = jobSkills.find(jSkill => jSkill.toLowerCase() === cSkill.toLowerCase());
      if (match) {
        edges.push({ source: cSkill, target: match, type: "matches" });
      }
    });

    // 2. Transferable skills (skills candidate has that are related/adjacent to job required but not exact match)
    candidateSkills.forEach(cSkill => {
      if (!jobLower.includes(cSkill.toLowerCase())) {
        // e.g. Candidate has PostgreSQL, Job requires MySQL -> Related
        const match = jobSkills.find(jSkill => {
          const js = jSkill.toLowerCase();
          const cs = cSkill.toLowerCase();
          return (
            (cs.includes("postgres") && js.includes("sql")) ||
            (cs.includes("fastapi") && js.includes("flask")) ||
            (cs.includes("react") && js.includes("vue")) ||
            (cs.includes("aws") && js.includes("cloud")) ||
            (cs.includes("docker") && js.includes("kubernetes"))
          );
        });
        if (match) {
          edges.push({ source: cSkill, target: match, type: "transferable_to" });
        }
      }
    });

    // 3. Team connection
    teamSkills.forEach(tSkill => {
      const match = jobSkills.find(jSkill => jSkill.toLowerCase() === tSkill.toLowerCase());
      if (match) {
        edges.push({ source: tSkill, target: match, type: "related_to" });
      }
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [candidateSkills, jobSkills, teamSkills]);

  // Animation & Force Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const runSimulation = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      const width = canvas.width;
      const height = canvas.height;

      // --- Force calculation ---
      const charge = -120; // Repulsion
      const gravity = 0.03; // Pull to center
      const linkForceStrength = 0.05; // Link attraction

      // 1. Repulsion force between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);

          if (dist < 180) {
            const force = charge / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            n1.vx += fx;
            n1.vy += fy;
            n2.vx -= fx;
            n2.vy -= fy;
          }
        }
      }

      // 2. Link attraction forces
      edges.forEach(edge => {
        const sNode = nodes.find(n => n.id === edge.source);
        const tNode = nodes.find(n => n.id === edge.target);
        if (sNode && tNode) {
          const dx = tNode.x - sNode.x;
          const dy = tNode.y - sNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const targetDist = 110;
          const k = linkForceStrength * (dist - targetDist);
          const fx = (dx / dist) * k;
          const fy = (dy / dist) * k;

          sNode.vx += fx;
          sNode.vy += fy;
          tNode.vx -= fx;
          tNode.vy -= fy;
        }
      });

      // 3. Gravity and update positions
      nodes.forEach(n => {
        if (n === activeDragNode) return; // ignore physics for dragged node

        // Pull to center
        n.vx += (width / 2 - n.x) * gravity;
        n.vy += (height / 2 - n.y) * gravity;

        // Apply friction
        n.vx *= 0.82;
        n.vy *= 0.82;

        n.x += n.vx;
        n.y += n.vy;

        // Keep inside bounds
        n.x = Math.max(n.radius, Math.min(width - n.radius, n.x));
        n.y = Math.max(n.radius, Math.min(height - n.radius, n.y));
      });

      // --- Draw Scene ---
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      
      // Apply translation (pan) and scaling (zoom)
      ctx.translate(pan.x + width / 2, pan.y + height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      // Draw edges
      edges.forEach(edge => {
        const sNode = nodes.find(n => n.id === edge.source);
        const tNode = nodes.find(n => n.id === edge.target);
        if (sNode && tNode) {
          ctx.beginPath();
          ctx.moveTo(sNode.x, sNode.y);
          ctx.lineTo(tNode.x, tNode.y);

          // Customize line appearance by connection type
          if (edge.type === "matches") {
            ctx.strokeStyle = "rgba(99, 102, 241, 0.4)"; // Indigo
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
          } else if (edge.type === "transferable_to") {
            ctx.strokeStyle = "rgba(168, 85, 247, 0.35)"; // Purple
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]); // Dashed
          } else {
            ctx.strokeStyle = "rgba(16, 185, 129, 0.25)"; // Emerald (team)
            ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 4]); // Dotted
          }
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(n => {
        const isHovered = hoveredNode?.id === n.id;
        
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + (isHovered ? 3 : 0), 0, 2 * Math.PI);

        // Node fill color by type
        let fillGradient = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, n.radius);
        if (n.type === "job") {
          fillGradient.addColorStop(0, "#818cf8"); // Lavender
          fillGradient.addColorStop(1, "#4f46e5"); // Indigo
          ctx.strokeStyle = isHovered ? "#ffffff" : "#6366f1";
        } else if (n.type === "candidate") {
          fillGradient.addColorStop(0, "#a855f7"); // Purple Light
          fillGradient.addColorStop(1, "#7c3aed"); // Violet Deep
          ctx.strokeStyle = isHovered ? "#ffffff" : "#8b5cf6";
        } else {
          fillGradient.addColorStop(0, "#34d399"); // Mint green
          fillGradient.addColorStop(1, "#059669"); // Emerald
          ctx.strokeStyle = isHovered ? "#ffffff" : "#10b981";
        }

        ctx.fillStyle = fillGradient;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Draw node labels (inside node)
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Truncate label if too long
        let label = n.label;
        if (label.length > 7) {
          label = label.substring(0, 5) + "..";
        }
        ctx.fillText(label, n.x, n.y);
      });

      ctx.restore();

      animationId = requestAnimationFrame(runSimulation);
    };

    runSimulation();

    return () => cancelAnimationFrame(animationId);
  }, [hoveredNode, zoom, pan, activeDragNode]);

  // Coordinate conversion: Client → Canvas Local Space
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Position on screen
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert to local canvas logic space accounting for CSS scaling
    const logicX = (clientX / rect.width) * canvas.width;
    const logicY = (clientY / rect.height) * canvas.height;

    // Account for zoom/pan
    const x = (logicX - (pan.x + canvas.width / 2)) / zoom + canvas.width / 2;
    const y = (logicY - (pan.y + canvas.height / 2)) / zoom + canvas.height / 2;

    return { x, y };
  };

  // Mouse handler: check if hovered node or start drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const nodes = nodesRef.current;

    // Find if clicked a node
    const clickedNode = nodes.find(n => {
      const dx = n.x - coords.x;
      const dy = n.y - coords.y;
      return Math.sqrt(dx * dx + dy * dy) < n.radius + 5;
    });

    if (clickedNode) {
      setActiveDragNode(clickedNode);
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const nodes = nodesRef.current;

    // Handle node dragging
    if (activeDragNode) {
      activeDragNode.x = coords.x;
      activeDragNode.y = coords.y;
      activeDragNode.vx = 0;
      activeDragNode.vy = 0;
      return;
    }

    // Handle canvas panning
    if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    // Find hover
    const hovered = nodes.find(n => {
      const dx = n.x - coords.x;
      const dy = n.y - coords.y;
      return Math.sqrt(dx * dx + dy * dy) < n.radius + 5;
    });

    setHoveredNode(hovered || null);
  };

  const handleMouseUp = () => {
    setActiveDragNode(null);
    setIsDraggingCanvas(false);
  };

  const resetGraph = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    // Reset positions randomly
    const canvas = canvasRef.current;
    if (canvas) {
      const width = canvas.width;
      const height = canvas.height;
      nodesRef.current.forEach(n => {
        n.x = width / 2 + (Math.random() - 0.5) * 150;
        n.y = height / 2 + (Math.random() - 0.5) * 150;
        n.vx = 0;
        n.vy = 0;
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="bg-[#14141d]/90 border border-[#242435] rounded-xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden flex flex-col gap-4 h-[440px]"
    >
      {/* Header and Controls */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h4 className="text-sm font-bold text-slate-200">Talent Knowledge Graph</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Interactive force-directed skills mapping</p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-1.5 bg-[#0d0d16] border border-[#242435] rounded-md p-1">
          <button 
            onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
            className="p-1 hover:bg-[#1b1b29] rounded text-slate-400 hover:text-indigo-400 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            className="p-1 hover:bg-[#1b1b29] rounded text-slate-400 hover:text-indigo-400 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={resetGraph}
            className="p-1 hover:bg-[#1b1b29] rounded text-slate-400 hover:text-indigo-400 transition-colors"
            title="Reset Graph"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 border border-indigo-400/25"></span>
          <span>Job Required</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 border border-purple-400/25"></span>
          <span>Candidate Core</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 border border-emerald-400/25"></span>
          <span>Team In-House</span>
        </div>
      </div>

      {/* Canvas wrapper */}
      <div className="relative flex-1 bg-[#0d0d16] border border-[#242435] rounded-lg overflow-hidden cursor-move">
        <canvas
          ref={canvasRef}
          width={650}
          height={260}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full block"
        />

        {/* Hover Information Overlay */}
        {hoveredNode && (
          <div className="absolute left-3 bottom-3 p-3 bg-[#14141d]/95 border border-[#2c2c3e] rounded-lg shadow-xl text-slate-200 text-xs w-48 backdrop-blur-md animate-fade-in pointer-events-none">
            <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-400 block mb-1">
              Skill Node details
            </span>
            <div className="font-bold text-slate-100 text-[13px]">{hoveredNode.label}</div>
            <div className="text-[10px] text-slate-400 mt-1 capitalize">
              Role Focus: <span className="font-semibold text-slate-300">{hoveredNode.type}</span>
            </div>
            <p className="text-[9px] text-slate-500 mt-1.5 leading-relaxed">
              {hoveredNode.type === "job" 
                ? "Core competency required for this role description."
                : hoveredNode.type === "candidate"
                  ? "Demonstrated capability from candidate's profile."
                  : "Possessed by one or more members of the current engineering team."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
