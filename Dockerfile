FROM python:3.10-slim

# system dependencies (opencv etc ke liye)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# working directory
WORKDIR /app

# requirements copy karo
COPY requirements.txt .

# install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# project files copy
COPY . .

# port expose
EXPOSE 5000

# run app
CMD ["python", "app.py"]