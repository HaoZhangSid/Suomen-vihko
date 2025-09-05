import os
import json
import re

def find_best_answer(question, sentences):
    """
    Finds the best answer for a given question from a list of sentences.
    This is a simple implementation and can be improved.
    """
    question_lower = question.lower()
    # Simple keyword-based matching
    if "kuka sinä olet" in question_lower:
        for s in sentences:
            if "minä olen" in s.lower() and "?" not in s:
                return s
    elif "minkä maalainen" in question_lower:
        for s in sentences:
            if ("minä olen" in s.lower() or "hän on" in s.lower()) and "?" not in s:
                 # A simple way to check if it's a nationality/country
                 if len(s.split()) > 2:
                    return s
    elif "mitä kieltä" in question_lower:
        for s in sentences:
            if "puhun" in s.lower() and "?" not in s:
                return s
    elif "mistä sinä olet kotoisin" in question_lower:
        for s in sentences:
            if "olen kotoisin" in s.lower() or "olen" in s.lower() and "lta" in s.lower() and "?" not in s:
                 return s
    elif "mikä tämä on" in question_lower:
        for s in sentences:
            if "se on" in s.lower() and "?" not in s:
                return s
    elif "onko kysymyksiä" in question_lower:
        # No direct answer found in lessons, providing a generic one.
        return "Ei ole kysymyksiä."
    
    # Generic fallback
    q_words = set(re.findall(r'\w+', question_lower))
    best_match = None
    max_overlap = 0
    for s in sentences:
        if "?" not in s:
            s_words = set(re.findall(r'\w+', s.lower()))
            overlap = len(q_words.intersection(s_words))
            if overlap > max_overlap:
                max_overlap = overlap
                best_match = s
    
    return best_match if best_match else "Vastausta ei löytynyt."


def process_lessons():
    lessons_dir = 'public/lessons'
    output_file = 'questions_and_answers.txt'

    all_questions = set()
    all_sentences = set()

    # Step 1 & 2: Scan files, extract questions and all sentences
    for filename in os.listdir(lessons_dir):
        if filename.endswith('.json'):
            filepath = os.path.join(lessons_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for entry in data.get('entries', []):
                    finnish_text = entry.get('finnish', '').strip()
                    if finnish_text:
                        all_sentences.add(finnish_text)
                        if finnish_text.endswith('?'):
                            all_questions.add(finnish_text)
    
    sorted_questions = sorted(list(all_questions))
    sentences_list = list(all_sentences)

    # Step 3 & 4: Generate answers and write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("Kysymykset ja Vastaukset Suomen Oppitunneista\n")
        f.write("==============================================\n\n")
        
        for i, question in enumerate(sorted_questions):
            answer = find_best_answer(question, sentences_list)
            f.write(f"{i+1}. Kysymys: {question}\n")
            f.write(f"   Vastaus: {answer}\n\n")

    print(f"Käsittely valmis. Tulokset tallennettu tiedostoon '{output_file}'.")

if __name__ == '__main__':
    process_lessons()
