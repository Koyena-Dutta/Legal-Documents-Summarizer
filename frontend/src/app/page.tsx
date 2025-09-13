"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : 'Unknown error';
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Waiting for file...");
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setStatus("File selected. Ready to process.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", file);

    setProgress(25);
    setStatus("Uploading to secure cloud storage...");
    
    setTimeout(() => {
      setProgress(50);
      setStatus("Analyzing document structure with Document AI...");
    }, 1500);

    setTimeout(() => {
      setProgress(75);
      setStatus("Preparing for interactive analysis with Gemini...");
    }, 3000);

    try {
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Backend response:', data);
      
      if (!data.chunks || !Array.isArray(data.chunks)) {
        throw new Error('Invalid response structure: missing chunks');
      }

      sessionStorage.removeItem('documentsData');
      sessionStorage.setItem('documentData', JSON.stringify(data));

      setProgress(100);
      setStatus("Analysis complete! Redirecting...");

      setTimeout(() => {
        router.push('/document/1');
      }, 1000);

    } catch (error: unknown) {
      console.error("Error processing document:", error);
      setStatus(`Error: ${getErrorMessage(error)}`);
      setProgress(0);
      setIsProcessing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <Card className="w-[450px] shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Legal Lens</CardTitle>
          <CardDescription>
            Upload a document to begin your AI-powered analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="grid w-full max-w-sm items-center gap-1.5 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-100"
            onClick={() => document.getElementById('document-input')?.click()}
          >
            <Label htmlFor="document-input" className="text-center">
              {file ? `Selected: ${file.name}` : "Drag & drop or click to upload"}
            </Label>
            <Input id="document-input" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx" />
          </div>
          {isProcessing && (
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
              <p className="mt-2 text-sm text-center text-gray-600">{status}</p>
            </div>
          )}
          <Button onClick={handleUpload} className="w-full mt-6" disabled={!file || isProcessing}>
            {isProcessing ? "Processing..." : "Analyze Document"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
