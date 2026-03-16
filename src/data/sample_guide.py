"""Sample guide payload used by /demo endpoint."""

SAMPLE_GUIDE: dict = {
    "lessonInfo": {
        "lessonName": "Introduction to Artificial Intelligence",
        "gradeLevel": "",
        "moduleLink": "",
        "slidesLink": "",
        "productionState": "Draft",
    },
    "overview": (
        "<p>In this session, students are introduced to Artificial Intelligence through "
        "hands-on exploration and guided discussion. The lesson flows from a warm-up "
        "into a structured explanation of how AI works, followed by a design task where "
        "students map out a simple AI solution to a real-world problem.</p>"
    ),
    "learningOutcomes": [
        "Recognise the definition of Artificial Intelligence and distinguish it from regular software.",
        "Identify at least three real-world examples of AI in everyday life.",
        "Analyse how data is used to train AI models using a simple visual example.",
        "Design a basic flowchart describing how an AI system would solve a chosen problem.",
        "Apply critical thinking to evaluate the benefits and limitations of AI tools.",
    ],
    "preparation": [
        "Review: machine learning basics, supervised vs unsupervised learning, common AI applications.",
        "You Will Need: Slides, Teacher Guide, printed AI example cards, internet-connected devices.",
        "You May Need: A backup offline activity; do a trial run of the Teachable Machine demo.",
    ],
    "outlineOverview": [],
    "lessonProcedure": [
        {
            "id": "demo-a1",
            "activityType": "Recap",
            "activityTitle": "Initiate",
            "duration": 10,
            "slideNumbers": "",
            "instructions": (
                "<p>1. Quick poll: ask students to raise their hand if they used AI today.</p>"
                "<p>2. Show a 60-second clip of AI in action (voice assistant, self-driving car).</p>"
                "<p>3. Ask: <strong>What made the computer able to do that?</strong> Allow 3–4 responses.</p>"
            ),
        },
        {
            "id": "demo-a2",
            "activityType": "Explore",
            "activityTitle": "Learn",
            "duration": 15,
            "slideNumbers": "",
            "instructions": (
                "<p>1. Display Slide 3: Definition. Ask a student to rephrase it.</p>"
                "<p>2. Analogy: <em>Teaching an AI is like teaching a child through examples.</em></p>"
                "<p>3. Walk through: Data → Training → Model → Prediction.</p>"
            ),
        },
        {
            "id": "demo-a3",
            "activityType": "Make",
            "activityTitle": "Make",
            "duration": 20,
            "slideNumbers": "",
            "instructions": (
                "<p>1. Distribute the AI Problem Solver worksheet.</p>"
                "<p>2. Students choose a real problem and draw a 4-step flowchart.</p>"
                "<p>3. Early finishers: add a <strong>What could go wrong?</strong> box.</p>"
            ),
        },
        {
            "id": "demo-a4",
            "activityType": "Share",
            "activityTitle": "Share",
            "duration": 10,
            "slideNumbers": "",
            "instructions": (
                "<p>1. Ask 2–3 volunteers to share their flowcharts.</p>"
                "<p>2. Prompt: <strong>Does this AI need a lot of data or a little?</strong></p>"
                "<p>3. Close: <em>Next lesson — train our own AI using Teachable Machine.</em></p>"
            ),
        },
    ],
    "publishingGuide": [""],
    "glossary": [
        {"id": "demo-g1", "concept": "Artificial Intelligence (AI)", "definition": "A computer system that performs tasks normally requiring human intelligence."},
        {"id": "demo-g2", "concept": "Machine Learning", "definition": "AI that learns from data examples instead of fixed rules."},
        {"id": "demo-g3", "concept": "Training Data", "definition": "Examples used to teach an AI model how to make decisions."},
        {"id": "demo-g4", "concept": "Algorithm", "definition": "A step-by-step set of instructions a computer follows to solve a problem."},
        {"id": "demo-g5", "concept": "Model", "definition": "The result of AI training — can make predictions based on what it learned."},
    ],
    "bonusActivities": [
        "Explore Teachable Machine and train a model to recognise gestures using a webcam.",
        "Research an AI bias case and write a paragraph explaining what went wrong and how to fix it.",
        "Create a 4-panel comic strip showing how an AI learns to do one task.",
    ],
}
