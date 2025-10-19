from http.server import BaseHTTPRequestHandler
import json
import os
import uuid
from daytona import Daytona, CreateSandboxParams
import google.generativeai as genai

# In a real deployment, these would be set as environment variables.
DAYTONA_API_KEY = os.environ.get("DAYTONA_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

def generate_manim_script(latex_equation, explanations):
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"""
    Create a Python script for Manim Community Edition that generates a video based on the following mathematical equation and explanations.

    **Equation (LaTeX):**
    {latex_equation}

    **Explanations:**
    {explanations}

    **Instructions:**
    1. The video should start by displaying the full equation.
    2. Then, for each variable or term mentioned in the explanations, highlight it in the equation while displaying the corresponding explanation text on the screen.
    3. The final scene should show the complete, non-highlighted equation again.
    4. The script should define a single Manim scene named 'EquationExplanation'.
    5. Ensure the script is self-contained and ready to be executed by `manim`.
    """
    response = model.generate_content(prompt)
    # Extract the Python code from the response, removing the markdown code block fences.
    return response.text.replace("```python", "").replace("```", "").strip()

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_len = int(self.headers.get('Content-Length'))
        post_body = self.rfile.read(content_len)
        data = json.loads(post_body)

        latex_equation = data.get('latex')
        explanations = data.get('explanations')

        if not all([latex_equation, explanations, DAYTONA_API_KEY, GEMINI_API_KEY]):
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Missing required data or API keys.'}).encode())
            return

        daytona = Daytona(api_key=DAYTONA_API_KEY)
        genai.configure(api_key=GEMINI_API_KEY)
        sandbox = None

        try:
            # 1. Generate Manim script
            manim_script_content = generate_manim_script(latex_equation, explanations)
            script_filename = f"manim_script_{uuid.uuid4()}.py"

            # 2. Create Daytona Sandbox
            params = CreateSandboxParams(language="python")
            sandbox = daytona.create(params)

            # 3. Install dependencies in the sandbox
            install_command = "pip install manim && manim-latex-downloader"
            response = sandbox.process.exec(install_command, timeout=300)
            if response.exit_code != 0:
                raise Exception(f"Failed to install Manim: {response.result}")

            # 4. Upload the Manim script
            sandbox.fs.upload_file(f"/home/daytona/{script_filename}", manim_script_content.encode())

            # 5. Run Manim to generate the video
            render_command = f"manim -pql /home/daytona/{script_filename} EquationExplanation"
            response = sandbox.process.exec(render_command, timeout=300)
            if response.exit_code != 0:
                raise Exception(f"Manim rendering failed: {response.result}")

            # 6. Download the video file
            # Manim saves files in /home/daytona/media/videos/<script_name_without_ext>/<resolution>/
            # We will assume 480p15 for the -pql flag.
            video_path = f"/home/daytona/media/videos/{script_filename.replace('.py', '')}/480p15/EquationExplanation.mp4"
            video_content = sandbox.fs.download_file(video_path)

            # 7. Return the video
            self.send_response(200)
            self.send_header('Content-type', 'video/mp4')
            self.end_headers()
            self.wfile.write(video_content)

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
        finally:
            # 8. Cleanup
            if sandbox:
                daytona.remove(sandbox)

        return