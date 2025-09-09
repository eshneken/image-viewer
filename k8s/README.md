# Image Viewer OKE Deployment

This directory contains Kubernetes manifests for deploying the Image Viewer application to Oracle Container Engine for Kubernetes (OKE) with Workload Identity Federation.

## Prerequisites

1. OKE Cluster with Workload Identity Federation enabled
2. `kubectl` configured to communicate with your OKE cluster
3. OCI CLI configured with appropriate permissions
4. Docker installed and configured
5. Access to Oracle Cloud Infrastructure Registry (OCIR) with appropriate permissions

## Setup Instructions

1. **Build and Push Docker Image to OCIR**

   First, build the Docker image and push it to OCIR:

   ```bash
   # Login to OCIR (replace region-code and tenancy-namespace)
   docker login <region-code>.ocir.io -u '<tenancy-namespace>/<username>' --password-stdin <<< "<auth-token>"
   
   # Build the Docker image  (docker build -t image-viewer . --platform linux/arm64)
   # Replace <region-code> with your region (e.g., iad, phx, etc.)
   # Replace <tenancy-namespace> with your tenancy namespace
   # Replace <repo-name> with your repository name (e.g., image-viewer)
   # Replace <tag> with your desired tag (e.g., latest, v1.0.0, etc.)
   
   # Navigate to the project root directory
   cd /path/to/image-viewer
   
   # Build the image
   docker build -t <region-code>.ocir.io/<tenancy-namespace>/<repo-name>:<tag> .
   
   # Push the image to OCIR
   docker push <region-code>.ocir.io/<tenancy-namespace>/<repo-name>:<tag>
   ```

   Example:
   ```bash
   docker login iad.ocir.io -u 'axr1abcdefg/john.doe@example.com' --password-stdin <<< "your-auth-token"
   docker build -t iad.ocir.io/axr1abcdefg/image-viewer:latest . --platform linux/arm64
   docker push iad.ocir.io/axr1abcdefg/image-viewer:latest
   ```

2. **Update Deployment with Image Details**

   Update the `deployment.yaml` file with your image details:
   
   ```yaml
   spec:
     containers:
     - name: image-viewer
       image: <region-code>.ocir.io/<tenancy-namespace>/<repo-name>:<tag>
       # ... rest of the deployment spec
   ```

3. **Create Image Pull Secret (if using private repository)**

   If your OCIR repository is private, create a Kubernetes secret to pull the image:
   
   ```bash
   kubectl create secret docker-registry ocir-secret \
     --docker-server=<region-code>.ocir.io \
     --docker-username='<tenancy-namespace>/<username>' \
     --docker-password='<auth-token>' \
     --docker-email='<your-email>' \
     -n image-viewer
   ```
   
   Then add the following to your `deployment.yaml`:
   
   ```yaml
   spec:
     imagePullSecrets:
     - name: ocir-secret
   ```

4. **Update Configuration**
   - Update `secret.yaml` with your base64-encoded secrets:
     ```bash
     # Generate base64-encoded values
     echo -n "your-password" | base64
     echo -n "your-secret-key" | base64
     echo -n "your-namespace" | base64
     echo -n "your-bucket-name" | base64
     echo -n "your-par-url" | base64
     ```

2. **Create IAM Policies**
   In OCI Console, create the following policies in the appropriate compartment:
   ```
   Allow any-user to use object-family in compartment sandbox where all {request.principal.type='workload',request.principal.namespace='image-viewer',request.principal.service_account='image-viewer-sa'}
   ```

3. **Create Namespace and Resources**
   ```bash
   # Apply the Kubernetes manifests
   kubectl apply -f namespace.yaml
   kubectl apply -f service-account.yaml
   kubectl apply -f configmap.yaml
   kubectl apply -f secret.yaml
   kubectl apply -f deployment.yaml
   kubectl apply -f service.yaml
   # Optional: If you have a domain and TLS certificates
   # kubectl create secret tls image-viewer-tls --cert=path/to/cert.crt --key=path/to/private.key -n image-viewer
   # kubectl apply -f ingress.yaml
   ```

4. **Verify Deployment**
   ```bash
   # Check pods
   kubectl get pods -n image-viewer
   
   # Check logs
   kubectl logs -f deployment/image-viewer -n image-viewer
   
   # Access the application
   kubectl port-forward svc/image-viewer 8080:80 -n image-viewer
   # Then open http://localhost:8080 in your browser
   ```

## Updating the Deployment

1. Update the container image:
   ```bash
   kubectl set image deployment/image-viewer image-viewer=<new-image-tag> -n image-viewer
   ```

2. Update configuration:
   - For ConfigMap changes:
     ```bash
     kubectl apply -f configmap.yaml
     kubectl rollout restart deployment/image-viewer -n image-viewer
     ```
   - For Secret changes:
     ```bash
     kubectl apply -f secret.yaml
     kubectl rollout restart deployment/image-viewer -n image-viewer
     ```

## Troubleshooting

1. **Authentication Issues**
   - Verify the service account has the correct IAM policies
   - Check pod logs for authentication errors
   - Verify the OCI region and other configurations are correct

2. **Image Pull Issues**
   - Verify the image exists in the container registry
   - Check if the cluster has pull access to the registry

3. **Workload Identity Issues**
   - Ensure Workload Identity is enabled on the OKE cluster
   - Verify the service account annotation matches the OCI service account name
   - Check the OCI IAM policies for the service account

## Cleanup

To delete all resources:

```bash
kubectl delete -f .
```
