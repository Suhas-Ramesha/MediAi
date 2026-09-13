import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Finding {
  title: string;
  description: string | string[];
}

interface MedicalReportProps {
  imageType: string;
  anatomicalRegion: string;
  findings: Finding[];
  clinicalInterpretation: string[];
  recommendations: Finding[];
}

export function MedicalReport({
  imageType,
  anatomicalRegion,
  findings,
  clinicalInterpretation,
  recommendations,
}: MedicalReportProps) {
  return (
    <Card className="w-full max-w-4xl mx-auto bg-white/60 backdrop-blur-xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-slate-800">
          Medical Report
        </CardTitle>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-600">
            <span className="font-semibold">Image Type:</span> {imageType}
          </p>
          <p className="text-sm font-medium text-slate-600">
            <span className="font-semibold">Anatomical Region:</span> {anatomicalRegion}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ScrollArea className="h-[600px] pr-4">
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Key Findings</h3>
            <div className="space-y-4">
              {findings.map((finding, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-medium text-slate-700">{finding.title}</h4>
                  {Array.isArray(finding.description) ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {finding.description.map((item, i) => (
                        <li key={i} className="text-sm text-slate-600">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600">{finding.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Clinical Interpretation</h3>
            <ul className="list-disc pl-5 space-y-2">
              {clinicalInterpretation.map((interpretation, index) => (
                <li key={index} className="text-sm text-slate-600">{interpretation}</li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Recommendations</h3>
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-medium text-slate-700">{rec.title}</h4>
                  {Array.isArray(rec.description) ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {rec.description.map((item, i) => (
                        <li key={i} className="text-sm text-slate-600">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600">{rec.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Important Notes</h3>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <ul className="list-disc pl-5 space-y-2">
                <li className="text-sm text-slate-700">
                  This report is based solely on the provided chest x-ray.
                </li>
                <li className="text-sm text-slate-700">
                  The interpretation of medical imaging is complex, and subtle findings can be difficult to assess with certainty.
                </li>
              </ul>
            </div>
          </section>
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 