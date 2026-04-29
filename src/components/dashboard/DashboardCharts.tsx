"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCompactCurrencyFromCents, formatCurrencyFromCents } from "@/lib/money";

export function DashboardCharts({
  stageOverview,
  callsByDay,
  wonRevenueByDay,
  outcomes
}: {
  stageOverview: { id: string; name: string; count: number; valueCents: number; color: string }[];
  callsByDay: { day: string; calls: number }[];
  wonRevenueByDay: { day: string; valueCents: number }[];
  outcomes: { name: string; value: number }[];
}) {
  return (
    <>
      <div className="grid grid-3">
        <section className="panel">
          <h2>Leads by stage</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageOverview}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stageOverview.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>Value by stage</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageOverview}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => formatCompactCurrencyFromCents(Number(value))} />
                <Tooltip formatter={(value) => formatCurrencyFromCents(Number(value))} />
                <Bar dataKey="valueCents" radius={[6, 6, 0, 0]}>
                  {stageOverview.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>Calls per day</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={callsByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="calls" stroke="#0f766e" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <section className="panel">
          <h2>Won revenue in 30 days</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wonRevenueByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => formatCompactCurrencyFromCents(Number(value))} />
                <Tooltip formatter={(value) => formatCurrencyFromCents(Number(value))} />
                <Line type="monotone" dataKey="valueCents" stroke="#12b76a" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>Outcomes in 30 days</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie data={outcomes} dataKey="value" nameKey="name" outerRadius={92} label>
                  {outcomes.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={["#0f766e", "#7a5af8", "#b42318", "#f79009", "#155eef"][index % 5]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </>
  );
}
