import React from "react";
import { View, Text, Pressable } from "react-native";

type Props = {
    children: React.ReactNode;
    title?: string;
};

type State = {
    hasError: boolean;
};

export default class ScreenCrashBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error("Screen crash boundary caught an error:", error);
    }

    private handleRetry = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-white text-xl font-bold mb-2">
                        {this.props.title || "Something went wrong"}
                    </Text>
                    <Text className="text-slate-400 text-center mb-5">
                        This screen hit an unexpected error. Try opening it again.
                    </Text>
                    <Pressable
                        onPress={this.handleRetry}
                        className="bg-slate-800 px-4 py-3 rounded-xl"
                    >
                        <Text className="text-white font-semibold">Try Again</Text>
                    </Pressable>
                </View>
            );
        }

        return this.props.children;
    }
}
