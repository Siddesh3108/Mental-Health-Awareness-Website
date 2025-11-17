document.addEventListener('DOMContentLoaded', function() {
    // Logic for the main mental health form
    const form = document.getElementById('mentalHealthForm');
    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            calculateScore();
        });
    }

    // Logic for the seminar registration form
    const regForm = document.getElementById("registrationForm");
    if (regForm) {
        regForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            // Collect form data
            const formData = new FormData(regForm);
            const body = {};
            formData.forEach((v, k) => body[k] = v);
            try {
                const resp = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const json = await resp.json();
                if (resp.ok && json.success) {
                    alert('Registration submitted — thank you!');
                    regForm.reset();
                } else {
                    alert('Submission failed: ' + (json.message || resp.statusText));
                }
            } catch (err) {
                console.error(err);
                alert('Network error while submitting.');
            }
        });
    }
    
    // Logic for stress busting exercise buttons
    const deepBreathingBtn = document.getElementById('deepBreathing');
    const muscleRelaxBtn = document.getElementById('muscleRelax');
    const meditationBtn = document.getElementById('meditation');

    if (deepBreathingBtn) {
        deepBreathingBtn.addEventListener('click', () => {
             alert('Follow the 4-7-8 breathing technique: Inhale through the nose for 4 seconds, hold the breath for 7 seconds, and exhale through the mouth for 8 seconds. Repeat this cycle several times to relax.');
        });
    }
    if (muscleRelaxBtn) {
        muscleRelaxBtn.addEventListener('click', () => {
            alert('Begin by tensing the muscles in your toes for a few seconds, then relax and feel the tension release. Continue this process, moving up through each muscle group in your body, until you reach your head.');
        });
    }
    if(meditationBtn) {
        meditationBtn.addEventListener('click', () => {
            alert('Find a quiet place to sit comfortably. Close your eyes and focus on your breath or a calming word or phrase. If your mind wanders, gently bring your focus back to the present moment.');
        });
    }
});

function calculateScore() {
    const form = document.getElementById('mentalHealthForm');
    const resultsContainer = document.getElementById('results');
    let totalScore = 0;
    let questionsCount = 12; // We have 12 questions
    let answeredQuestions = 0;

    for (let i = 1; i <= questionsCount; i++) {
        const questionName = 'q' + i;
        const selectedOption = form.elements[questionName];
        if (selectedOption && selectedOption.value) {
            totalScore += parseInt(selectedOption.value);
            answeredQuestions++;
        }
    }

    if (answeredQuestions < questionsCount) {
        resultsContainer.innerHTML = '<h3>Please answer all questions to see your score.</h3>';
        resultsContainer.style.backgroundColor = '#ffc107'; // Warning color
        resultsContainer.style.color = '#333';
        return;
    }

    const averageScore = totalScore / questionsCount;
    let mentalHealthState = '';
    let advice = '';

    if (averageScore >= 3.5) {
        mentalHealthState = 'Healthy';
        advice = 'You seem to be in a good mental state. Keep maintaining your healthy habits, stay connected with others, and continue to prioritize your well-being.';
        resultsContainer.style.backgroundColor = '#d4edda'; // Green
        resultsContainer.style.color = '#155724';
    } else if (averageScore >= 3) {
        mentalHealthState = 'Mild Concerns';
        advice = 'You may be experiencing some minor stress or emotional challenges. It\'s a good time to focus on self-care, such as exercise, nutrition, and mindfulness. Talking to a friend or family member may also be helpful.';
        resultsContainer.style.backgroundColor = '#fff3cd'; // Yellow
        resultsContainer.style.color = '#856404';
    } else if (averageScore >= 2.5) {
        mentalHealthState = 'Moderate Concerns';
        advice = 'Your responses suggest you are facing notable mental health challenges. It is highly recommended to speak with a trusted individual. Exploring resources on our site or contacting a professional could provide significant support.';
        resultsContainer.style.backgroundColor = '#f8d7da'; // Orange-Red
        resultsContainer.style.color = '#721c24';
    } else {
        mentalHealthState = 'Severe Concerns';
        advice = 'It appears you are going through a difficult time. Please prioritize your mental health and seek professional help. You are not alone, and support is available. Please visit our <a href="Contact.html">Contact</a> page to find a professional near you.';
        resultsContainer.style.backgroundColor = '#dc3545'; // Red
        resultsContainer.style.color = 'white';
    }
    
    resultsContainer.innerHTML = `
        <h3>Your Result: ${mentalHealthState}</h3>
        <p>${advice}</p>
    `;
    resultsContainer.scrollIntoView({ behavior: 'smooth' });

    // Optionally send anonymous score to backend for demo persistence
    try {
        fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: averageScore })
        }).catch(() => {/* ignore network errors for analytics */});
    } catch (e) {}
}

// Handle contact form submission (if present)
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const respDiv = document.getElementById('contactResponse');
            const fd = new FormData(contactForm);
            const body = {};
            fd.forEach((v, k) => body[k] = v);
            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const json = await res.json();
                if (res.ok && json.success) {
                    respDiv.innerText = 'Message sent — thank you!';
                    contactForm.reset();
                } else {
                    respDiv.innerText = 'Failed to send message: ' + (json.message || res.statusText);
                }
            } catch (err) {
                console.error(err);
                respDiv.innerText = 'Network error while sending message.';
            }
        });
    }
});