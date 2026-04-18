/**
 * Face-match + liveness con AWS Rekognition.
 *
 * Liveness:
 *   - Tomamos 3 frames (center, "usuario gira a SU izquierda", "usuario gira a
 *     SU derecha") del lado cliente.
 *   - DetectFaces en cada uno devuelve `Pose.Yaw` (rotación horizontal, -180..180).
 *
 *   Convención AWS Rekognition: yaw POSITIVO = cabeza rotada hacia la derecha
 *   del observador (la cámara). Cuando el usuario gira a SU propia izquierda,
 *   la cámara ve la cabeza girada hacia su derecha → yaw > 0.
 *
 *   Entonces:
 *     yaw[center] ≈ 0
 *     yaw[user-left]  > +umbral   (usuario giró a su izquierda)
 *     yaw[user-right] < -umbral   (usuario giró a su derecha)
 *   Si los 3 yaw son ~idénticos → photo estática → fail.
 *
 * Face-match:
 *   - CompareFaces(sourceImage=DNI, targetImage=frame_center)
 *   - Similarity ≥ KYC_FACE_MATCH_MIN (default 85) → pass
 *
 * Requiere en Vercel env:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (ej. us-east-1)
 */

import {
  RekognitionClient,
  DetectFacesCommand,
  CompareFacesCommand,
} from "@aws-sdk/client-rekognition";

const FACE_MATCH_MIN = Number(process.env.KYC_FACE_MATCH_MIN ?? "85");
// Umbral de rotación en grados. 8 es suficiente para detectar un giro real y
// tolerante con usuarios que no giran tan pronunciadamente.
const LIVENESS_YAW_THRESHOLD = Number(process.env.KYC_LIVENESS_YAW_MIN ?? "8");

let _client: RekognitionClient | null = null;
function client(): RekognitionClient {
  if (_client) return _client;
  const region = process.env.AWS_REGION ?? "us-east-1";
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "Faltan AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY para Rekognition.",
    );
  }
  _client = new RekognitionClient({ region });
  return _client;
}

export interface LivenessResult {
  passed: boolean;
  yaws: number[];
  faces_detected: number[];
  reason?: string;
}

export async function checkLiveness(frameBytes: Buffer[]): Promise<LivenessResult> {
  if (frameBytes.length < 3) {
    return {
      passed: false,
      yaws: [],
      faces_detected: [],
      reason: "insufficient_frames",
    };
  }

  const yaws: number[] = [];
  const facesDetected: number[] = [];

  for (const bytes of frameBytes) {
    const resp = await client().send(
      new DetectFacesCommand({
        Image: { Bytes: bytes },
        Attributes: ["DEFAULT"], // Pose viene incluido en default
      }),
    );
    const faces = resp.FaceDetails ?? [];
    facesDetected.push(faces.length);
    if (faces.length === 0) {
      yaws.push(NaN);
      continue;
    }
    // Tomar la cara más grande (mejor candidata)
    const largest = faces.reduce((a, b) => {
      const aW = a.BoundingBox?.Width ?? 0;
      const bW = b.BoundingBox?.Width ?? 0;
      return aW > bW ? a : b;
    });
    yaws.push(largest.Pose?.Yaw ?? 0);
  }

  // Cada frame debe tener al menos 1 cara
  if (facesDetected.some((n) => n === 0)) {
    return { passed: false, yaws, faces_detected: facesDetected, reason: "face_missing_in_frame" };
  }

  const [yC, yL, yR] = yaws;
  // yC = frame 1 (mirando al frente)
  // yL = frame 2 (usuario giró a SU izquierda → AWS ve yaw positivo)
  // yR = frame 3 (usuario giró a SU derecha  → AWS ve yaw negativo)
  const centerOk = Math.abs(yC) < LIVENESS_YAW_THRESHOLD * 1.5;
  const leftOk = yL > LIVENESS_YAW_THRESHOLD;
  const rightOk = yR < -LIVENESS_YAW_THRESHOLD;

  if (!centerOk || !leftOk || !rightOk) {
    return {
      passed: false,
      yaws,
      faces_detected: facesDetected,
      reason: "head_pose_static",
    };
  }

  return { passed: true, yaws, faces_detected: facesDetected };
}

export interface FaceMatchResult {
  similarity: number;
  matched: boolean;
  raw: unknown;
}

export async function compareFaces(
  dniImageBytes: Buffer,
  selfieFrameBytes: Buffer,
): Promise<FaceMatchResult> {
  const resp = await client().send(
    new CompareFacesCommand({
      SourceImage: { Bytes: dniImageBytes },
      TargetImage: { Bytes: selfieFrameBytes },
      SimilarityThreshold: 50, // Pedimos bajo para tener el score real
      QualityFilter: "AUTO",
    }),
  );

  const best = (resp.FaceMatches ?? []).reduce(
    (acc, m) => (m.Similarity ?? 0) > acc ? (m.Similarity ?? 0) : acc,
    0,
  );

  return {
    similarity: best,
    matched: best >= FACE_MATCH_MIN,
    raw: resp,
  };
}

export { FACE_MATCH_MIN };
