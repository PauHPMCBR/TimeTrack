# Registre de jornada

## Project Description

A full-stack, containerized application for employees to register their work check-ins and check-outs. It features a modern web interface, a secure backend API, user authentication, and a chatbot service, all orchestrated using Kubernetes for scalability and resilience.

Key Features:
- Employee time tracking (check-in/check-out)
- Secure SAML-based authentication via NextAuth.js
- Responsive frontend built with Next.js and Tailwind CSS
- RESTful API backend
-Chatbot integration
-Multi-service architecture with Kubernetes

## Tech Stack
| Component	| Technology |
|---|---|
| Frontend	| Next.js 14, TypeScript, Tailwind CSS |
| Backend	| Next.js API Routes (or separate Node.js) |
| Authentication |	NextAuth.js (SAML) |
| Database |	MongoDB with Mongoose ODM |
| Containerization |	Docker |
| Orchestration	| Kubernetes |
| Development |	ESLint, Prettier, TypeScript |


## System Architecture

The application is composed of several interconnected services:

- Frontend Pod: Serves the Next.js web application to users. It handles user interactions and communicates with the backend API
- Backend Pod: Contains the business logic and API endpoints for authentication and time record processing
- Chatbot Pod: Hosts the AI/automated interaction service
- MongoDB Pod: The stateful service responsible for data persistence, storing user accounts and time records

These services are deployed as separate Pods (the smallest deployable units in Kubernetes) within a cluster.

They are managed by Deployments, which ensure the desired number of pod replicas are running and handle updates and rollbacks. Services provide a stable network endpoint to allow the frontend, backend, and chatbot pods to communicate with each other and the database


## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- Bun (version 1.0 or higher)
- Docker
- Docker compose
- kubectl (Kubernetes command-line tool)
- A Kubernetes cluster (e.g., Minikube for local development)
- A MongoDB database

## Setup & Installation Guide

Follow these steps to get the project running in a local development environment.
### Phase 1: Local Repository and Dependency Setup

Clone the Repository
```bash
git clone <your-repository-url>
cd time-record-app
```

Install Dependencies
```bash
bun install
```

#### Environment Configuration
Create a .env.local file in the frontend directory and a .env file in the backend directory. You will need to set up the following environment variables. For security, never commit these files to version control.

Frontend (.env.local):
```env
NEXTAUTH_SECRET=your-secret-here-at-least-32-characters-long
# URL of your backend service (for Kubernetes, this will be the service name)
BACKEND_URL=http://localhost:3001
```

Backend (.env):
```env
MONGODB_URI= (the proper mongodb url, see the database connection section)
NEXTAUTH_SECRET=your-secret-here-at-least-32-characters-long
```

### Phase 2: Database Connection

The project uses Mongoose to manage the connection to MongoDB. The application uses a connection utility to cache the database connection, which optimizes performance in environments like Kubernetes by reusing connections across requests.

You can use MongoDB for managing the database easily. The connexion is within the proper url:
- Using the local mongodb: mongodb://<username>:<password>@localhost:27017/<dbname>?authSource=myapp
- Using MongoDB Atlas: mongodb+srv://<username>:<password>@cluster0.mongodb.net/<dbname>?retryWrites=true&w=majority
- Using the database created by the docker-compose: mongodb://alumne:XGmHckQJzwzFKwBo14YA@localhost:27018/myapp?authSource=myapp

### Phase 3: Running the Application Locally
#### 3.1. With docker-compose
Start the application with the docker compose:
```bash
docker-compose up --build
```

The backend API should now be running on http://localhost:3001.
The frontend application should now be running on http://localhost:3000.
The database should now be running on the port 27018 (to avoid the conventional 27017 mongodb port)
#### 3.2. Without docker-compose
You will have to use MongoDB Atlas or the local mongodb

Start all services from the root:
```bash
bun run dev
```

Or start individually:
Start the Backend Server:
```bash
cd backend
bun run dev
```

The backend API should now be running on http://localhost:3001.

Start the Frontend Development Server:
Open a new terminal window.
```bash
cd frontend
bun run dev
```

The frontend application should now be running on http://localhost:3000.

## Kubernetes Deployment

## Prerequisites
- kubeadm installed
- kubectl installed
- The yaml files on k8s folder

### 1. Installation

#### 1.1 All the nodes
```
sudo apt update

sudo apt install -y containerd

sudo apt install -y apt-transport-https ca-certificates curl
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt update
sudo apt install -y kubelet=1.28.15-00 kubeadm=1.28.15-00 kubectl=1.28.15-00
sudo apt-mark hold kubelet kubeadm kubectl

containerd config default | sudo tee /etc/containerd/config.toml
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd
```

#### 1.2. Only in the control-plane node
```
sudo kubeadm init --control-plane-endpoint "10.4.41.75:6443" --pod-network-cidr=10.244.0.0/16

mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

#### 1.3. Only in the worker nodes
```
sudo kubeadm join 10.4.41.75:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>
```

#### 1.4. Build images and push into Docker-Hub

```bash
docker-compose build
docker tag registre-jornada-frontend:latest godack/registre-jornada-frontend:1.0 
docker tag registre-jornada-backend:latest godack/registre-jornada-backend:1.0 
docker push godack/registre-jornada-frontend:1.0
docker push godack/registre-jornada-backend:1.0
```


### 2. Kubernetes Deployment


```
cd k8s
kubectl apply -f mongodb-secret.yaml
kubectl apply -f mongo-init-configmap.yaml
kubectl apply -f mongodb-pv.yaml  # Si lo tienes
kubectl apply -f mongodb-data-persistentvolumeclaim.yaml
kubectl apply -f mongodb-deployment.yaml
kubectl apply -f mongodb-service.yaml
sleep 20
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
sleep 10
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
sleep 10
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
kubectl apply -f dashboard.yaml
```


### 3. Accessing the Application

The backend API should now be running on http://{serverip}:30001.

The frontend application should now be running on http://{serverip}:30000.

The database should now be running on the port 30002

The admin dashboard now shoud be running on https://{serverip}:30003.

Run `kubectl -n kubernetes-dashboard create token admin-user --duration=24h` to get a token for the admin dashboard

### 4. Monitoring and Management

#### 4.1. Check Deployment Status
##### 4.1.1. Check all resources
```
kubectl get all
```

##### 4.1.2. Check pods status
```
kubectl get pods -w
```

##### 4.1.3. Check services
```
kubectl get services
```

##### 4.1.4. Check logs
```
kubectl logs deployment/backend
kubectl logs deployment/frontend
kubectl logs deployment/mongodb
```

#### 4.2. Troubleshooting Commands
##### 4.2.1. Describe pods for detailed info
```
kubectl describe pod <pod-name>
```

##### 4.2.2. Check environment variables
```
kubectl describe deployment backend | grep -A10 Environment
```

##### 4.2.3. Check service endpoints
```
kubectl describe service mongodb
kubectl describe service backend
```

#### 4.3. Cleanup
##### 4.3.1. Delete all resources
```
kubectl delete -f ./
kubectl delete -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
```

##### 4.3.2. Stop Minikube
```
minikube stop
```

##### 4.3.3. Delete Minikube cluster
```
minikube delete --all --purge
rm -rf ~/.minikube
eval $(minikube docker-env -u)
```

## API Reference
### Authentication Endpoints
- POST /api/auth/signin - Initiates SAML sign-in flow.
- POST /api/auth/signout - Signs out the current user.

### Time Record Endpoints
- POST /api/records/checkin - Registers a check-in. Requires authentication.
- POST /api/records/checkout - Registers a check-out. Requires authentication.
- GET /api/records - Retrieves time records (user-specific or manager view). Requires authentication.


## Troubleshooting
MongoDB connection failed: Double-check your MONGODB_URI in the Secrets and ensure your MongoDB Atlas IP whitelist allows connections from your cluster.

ImagePullBackOff error in Kubernetes: Ensure your Docker images are built and tagged correctly, and are available in your Minikube's Docker environment or a remote container registry.

Backend service not found from Frontend: Confirm the backend service is running and check the BACKEND_URL configuration in the frontend ConfigMap.

Checking Pod Logs: Use kubectl logs -f <pod-name> -n time-record-app to view logs from a specific pod for debugging.
