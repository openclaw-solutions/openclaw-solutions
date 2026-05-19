#!/usr/bin/env python3
"""
Grace's Self-Improving Research Engine v2
- Searches DDG for real estate + AI topics
- Tracks which topics return useful results
- Automatically refines queries based on result quality
- Builds a knowledge base of what's worth searching
"""
import json, os, time
from ddgs import DDGS

DATA_FILE = "/opt/agent-mesh/research-knowledge.json"
REPORT_FILE = "/opt/agent-mesh/morning-report.txt"

def load_knowledge():
    try:
        with open(DATA_FILE) as f:
            return json.load(f)
    except:
        return {
            "topics": [
                {"query": "AI for real estate agents 2026 best tools", "score": 0, "runs": 0, "last_results": 0},
                {"query": "how boutique brokerages use AI for lead generation", "score": 0, "runs": 0, "last_results": 0},
                {"query": "OpenClaw AI agent skills real estate", "score": 0, "runs": 0, "last_results": 0},
                {"query": "real estate CRM automation AI agents 2026", "score": 0, "runs": 0, "last_results": 0},
                {"query": "AI podcast real estate brokerage growth strategies 2026", "score": 0, "runs": 0, "last_results": 0},
                {"query": "boutique real estate brokerage marketing automation", "score": 0, "runs": 0, "last_results": 0},
                {"query": "AI virtual assistant for real estate brokers", "score": 0, "runs": 0, "last_results": 0}
            ],
            "variations": {},
            "total_runs": 0
        }

def save_knowledge(kb):
    with open(DATA_FILE, 'w') as f:
        json.dump(kb, f, indent=2)

def search(query, max_results=5):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results, timelimit='y'))
            if not results:
                results = list(ddgs.text(query, max_results=max_results))
            return [(r.get('title','')[:100], r.get('href',''), r.get('body','')[:200]) for r in results]
    except:
        return []

def score_results(results):
    """Score how useful a set of results is (0-100)"""
    if not results:
        return 0
    score = min(len(results) * 15, 60)  # More results = better
    # Bonus for titles with actionable keywords
    keywords = ["guide", "best", "top", "how to", "tips", "strategy", "tools", "automation", "growth", "lead"]
    for title, _, body in results:
        lower = (title + " " + body).lower()
        for kw in keywords:
            if kw in lower:
                score += 5
    return min(score, 100)

def generate_variations(topic, score):
    """Generate better queries based on past performance"""
    if score < 30:
        # Too narrow — broaden
        if "2026" in topic:
            return [topic.replace("2026", "2026 2025")]
        return [topic + " tips", topic + " strategies"]
    elif score > 70:
        # Doing well — specialize
        words = topic.split()
        if len(words) > 3:
            return [topic + " case study", topic + " examples"]
    return []

def main():
    kb = load_knowledge()
    kb["total_runs"] += 1
    date = time.strftime("%Y-%m-%d")
    
    report = [f"=== Grace Morning Report — {date} ===", ""]
    
    for t in kb["topics"]:
        t["runs"] += 1
        
        # Try the main query
        results = search(t["query"])
        score = score_results(results)
        t["score"] = (t["score"] * (t["runs"] - 1) + score) / t["runs"]
        t["last_results"] = len(results)
        
        report.append(f"## {t['query']}")
        report.append(f"   Results: {len(results)} | Score: {score:.0f}/100")
        
        if results:
            for title, href, body in results[:4]:
                report.append(f"  • {title}")
                report.append(f"    {body[:100]}")
        else:
            # Try a variation if main query failed
            variations = generate_variations(t["query"], score)
            alt_found = False
            for var in variations[:1]:
                alt_results = search(var)
                if alt_results:
                    report.append(f"  (broadened to: {var})")
                    for title, href, body in alt_results[:3]:
                        report.append(f"  • {title}")
                        report.append(f"    {body[:100]}")
                    alt_found = True
                    break
            if not alt_found:
                report.append("  (no results this cycle)")
        
        report.append("")
    
    # Add learning summary
    report.append("---")
    report.append("## Learning Summary")
    improving = [t for t in kb["topics"] if t["score"] > 50 and t["runs"] > 1]
    struggling = [t for t in kb["topics"] if t["score"] < 20 and t["runs"] > 1]
    if improving:
        report.append(f"Improving: {', '.join(t['query'][:40] for t in improving[:3])}")
    if struggling:
        report.append(f"Need refinement: {', '.join(t['query'][:40] for t in struggling[:3])}")
    report.append(f"Total research runs: {kb['total_runs']}")
    
    save_knowledge(kb)
    
    with open(REPORT_FILE, 'w') as f:
        f.write('\n'.join(report) + '\n')
    
    print(f"Research complete — {date}")
    print(f"Topics: {len(kb['topics'])} | Avg score: {sum(t['score'] for t in kb['topics'])/len(kb['topics']):.0f}")

if __name__ == "__main__":
    main()
